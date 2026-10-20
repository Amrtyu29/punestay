"""Builds data/locality_rents.csv from real published figures.

Source 1 (listing level, CC0): Kaggle "Rental price of India's IT capital, Pune" by Anant Sakhare, July 2021,
  ~16k flat listings with locality names and monthly rent. Downloaded to data/raw/rental-listings/kaggle-pune-rentals/.
  We take the per-locality median 1 BHK rent (and 2 BHK for reference). These are 2021 figures and are NOT
  inflation-adjusted; the app labels every rent derived from them as an estimate.

PG and hostel rents are not published per locality anywhere open. We derive them from the 1 BHK median with
fixed ratios that match the ANAROCK / Quikr 2025 ranges we saw for Hinjewadi, Wakad, Kothrud and Viman Nagar:
  pg_single = 0.55 x 1BHK, pg_shared = 0.35 x 1BHK, hostel = 0.30 x 1BHK (rounded to 100).
Change the ratios in RATIOS if you get better figures. Locality coordinates come from OSM place nodes.

Usage:
    python scripts/build_locality_rents.py
"""
import csv
import difflib
import json
import re
import statistics
from collections import defaultdict

from common import DATA, OVERPASS_DIR

RAW = DATA / "raw" / "rental-listings" / "kaggle-pune-rentals" / "unzipped"
RATIOS = {"pg_single": 0.60, "pg_shared": 0.40, "hostel": 0.35}
MIN_ROWS = 8

# 2021 -> 2025 calibration: ANAROCK Residential Market Viewpoints Pune Q1 2025 gives average quoted 2 BHK rents
# (midpoints below). The uplift factor is the median ratio of these to the Kaggle 2021 2 BHK medians.
ANAROCK_2BHK_2025 = {"Wagholi": 24000, "Hinjawadi": 28500, "Wakad": 28650, "Undri": 20750, "Talegaon Dabhade": 14000}

ALIASES = {  # Kaggle spelling -> OSM place name
    "shivaji nagar": "Shivajinagar", "pimple saudagar": "Pimple Saudagar", "pimple nilakh": "Pimple Nilakh",
    "viman nagar": "Viman Nagar", "hinjewadi": "Hinjawadi", "hinjawadi": "Hinjawadi", "magarpatta city": "Magarpatta",
    "nibm": "NIBM Road", "kalyani nagar": "Kalyani Nagar", "koregaon park": "Koregaon Park", "pune station": "Pune Railway Station",
    "balewadi": "Balewadi", "aundh": "Aundh", "wagholi": "Wagholi", "hadapsar": "Hadapsar", "kharadi": "Kharadi",
    "bavdhan": "Bavdhan", "pashan": "Pashan", "baner": "Baner", "wakad": "Wakad", "kothrud": "Kothrud",
    "warje": "Warje", "karve nagar": "Karve Nagar", "bibwewadi": "Bibvewadi", "dhanori": "Dhanori", "lohegaon": "Lohegaon",
    "undri": "Undri", "kondhwa": "Kondhwa", "katraj": "Katraj", "dhayari": "Dhayari", "ambegaon": "Ambegaon Budruk",
    "sinhagad road": "Sinhgad Road", "sinhgad road": "Sinhgad Road", "erandwane": "Erandwane", "deccan gymkhana": "Deccan Gymkhana",
    "camp": "Pune Camp", "yerwada": "Yerawada", "yerawada": "Yerawada", "mundhwa": "Mundhwa", "keshav nagar": "Keshav Nagar",
    "wadgaon sheri": "Wadgaon Sheri", "vadgaon sheri": "Wadgaon Sheri", "ravet": "Ravet", "tathawade": "Tathawade",
    "punawale": "Punawale", "moshi": "Moshi", "chinchwad": "Chinchwad", "pimpri": "Pimpri", "nigdi": "Nigdi", "akurdi": "Akurdi",
    "sus": "Sus", "mahalunge": "Mahalunge", "chakan": "Chakan", "talegaon dabhade": "Talegaon Dabhade",
}


# Well-known localities that OSM does not tag as place nodes inside our bbox (approximate centres).
FALLBACK_COORDS = {
    "hadapsar": ("Hadapsar", 18.5089, 73.9260), "kothrud": ("Kothrud", 18.5074, 73.8077),
    "undri": ("Undri", 18.4529, 73.9145), "koregaon park": ("Koregaon Park", 18.5362, 73.8939),
    "magarpatta": ("Magarpatta", 18.5158, 73.9289), "magarpatta city": ("Magarpatta", 18.5158, 73.9289),
    "nibm": ("NIBM Road", 18.4690, 73.9035), "lohegaon": ("Lohegaon", 18.5990, 73.9280),
    "moshi": ("Moshi", 18.6700, 73.8550), "sinhgad road": ("Sinhgad Road", 18.4830, 73.8220),
    "sinhagad road": ("Sinhgad Road", 18.4830, 73.8220), "wadgaon sheri": ("Wadgaon Sheri", 18.5540, 73.9170),
    "vadgaon sheri": ("Wadgaon Sheri", 18.5540, 73.9170), "bibwewadi": ("Bibvewadi", 18.4750, 73.8650),
    "wanowrie": ("Wanowrie", 18.4880, 73.9000), "mohamadwadi": ("Mohammadwadi", 18.4700, 73.9200),
    "mohammadwadi": ("Mohammadwadi", 18.4700, 73.9200), "pimpri chinchwad": ("Pimpri-Chinchwad", 18.6280, 73.8000),
    "chikhali": ("Chikhali", 18.6770, 73.8260), "handewadi": ("Handewadi", 18.4700, 73.9400),
    "phursungi": ("Phursungi", 18.4660, 73.9560), "dighi": ("Dighi", 18.6150, 73.8720),
    "dange chowk": ("Dange Chowk", 18.6180, 73.7700), "narhe": ("Narhe", 18.4530, 73.8120),
    "lullanagar": ("Lullanagar", 18.4850, 73.8910), "eon free zone": ("Kharadi", 18.5516, 73.9405),
    "phase-3 hinjewadi": ("Hinjawadi", 18.5912, 73.7389), "viman nagar": ("Viman Nagar", 18.5679, 73.9143),
    "kharadi": ("Kharadi", 18.5510, 73.9430), "shivaji nagar": ("Shivajinagar", 18.5300, 73.8480),
    "karve nagar": ("Karve Nagar", 18.4900, 73.8200), "warje": ("Warje", 18.4820, 73.8000),
    "bavdhan": ("Bavdhan", 18.5150, 73.7760), "pashan": ("Pashan", 18.5380, 73.7900),
    "katraj": ("Katraj", 18.4480, 73.8580), "kondhwa": ("Kondhwa", 18.4650, 73.8900),
    "dhayari": ("Dhayari", 18.4560, 73.8030), "yerwada": ("Yerawada", 18.5520, 73.8820),
    "dhanori": ("Dhanori", 18.5900, 73.9070), "ambegaon": ("Ambegaon Budruk", 18.4450, 73.8400),
    "mundhwa": ("Mundhwa", 18.5300, 73.9280), "keshav nagar": ("Keshav Nagar", 18.5380, 73.9400),
    "balewadi": ("Balewadi", 18.5760, 73.7700), "tathawade": ("Tathawade", 18.6190, 73.7510),
    "ravet": ("Ravet", 18.6490, 73.7420), "punawale": ("Punawale", 18.6240, 73.7390),
    "sus": ("Sus", 18.5480, 73.7510), "mahalunge": ("Mahalunge", 18.5880, 73.7580),
    "pimple nilakh": ("Pimple Nilakh", 18.5740, 73.7940), "pimple gurav": ("Pimple Gurav", 18.5890, 73.8180),
    "erandwane": ("Erandwane", 18.5100, 73.8300), "deccan gymkhana": ("Deccan Gymkhana", 18.5170, 73.8410),
    "camp": ("Pune Camp", 18.5120, 73.8800), "bhosari": ("Bhosari", 18.6300, 73.8460),
    "wagholi": ("Wagholi", 18.5800, 73.9800), "hinjewadi": ("Hinjawadi", 18.5912, 73.7389),
    "wakad": ("Wakad", 18.5990, 73.7620), "baner": ("Baner", 18.5600, 73.7900), "aundh": ("Aundh", 18.5590, 73.8070),
    "pimple saudagar": ("Pimple Saudagar", 18.5990, 73.7960), "kalyani nagar": ("Kalyani Nagar", 18.5480, 73.9030),
}


def locality_of(address: str) -> str | None:
    parts = [p.strip() for p in address.split(",")]
    parts = [p for p in parts if p and p.lower() not in ("pune", "maharashtra")]
    if len(parts) >= 2:
        return parts[1]
    return parts[0] if parts else None


def load_kaggle():
    rows = []
    for name in ("train.csv", "test.csv"):
        path = RAW / name
        if not path.exists():
            raise SystemExit(f"Missing {path}. See data/DATA_SOURCES.md for the download URL.")
        with path.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                try:
                    rent = float(r["rent"])
                    bhk = int(float(r["bedroom"]))
                    area = float(r.get("area") or 0)
                except (ValueError, KeyError):
                    continue
                if not (2000 <= rent <= 200000) or area <= 100 or bhk < 1 or bhk > 4:
                    continue
                loc = locality_of(r.get("address", ""))
                if not loc:
                    continue
                rows.append((loc.strip().lower(), bhk, rent))
    return rows


def load_osm_localities():
    fc = json.loads((OVERPASS_DIR / "locality.geojson").read_text(encoding="utf-8"))
    out = {}
    for f in fc["features"]:
        n = f["properties"].get("name")
        if n:
            lng, lat = f["geometry"]["coordinates"]
            out.setdefault(n.lower(), (n, lat, lng))
    return out


def main():
    rows = load_kaggle()
    osm = load_osm_localities()
    osm_names = list(osm)
    by_loc = defaultdict(lambda: defaultdict(list))
    for loc, bhk, rent in rows:
        by_loc[loc][bhk].append(rent)

    # Calibrate 2021 figures to 2025 using the ANAROCK 2 BHK table.
    ratios = []
    for loc, bhks in by_loc.items():
        name = (FALLBACK_COORDS.get(loc) or FALLBACK_COORDS.get(ALIASES.get(loc, loc).lower()) or (None,))[0]
        if name in ANAROCK_2BHK_2025 and bhks.get(2) and len(bhks[2]) >= MIN_ROWS:
            ratios.append(ANAROCK_2BHK_2025[name] / statistics.median(bhks[2]))
    factor = round(statistics.median(ratios), 2) if ratios else 1.0
    print(f"2021->2025 uplift factor {factor} from {len(ratios)} ANAROCK localities")
    source = (f"Kaggle CC0 'Rental price of Pune' (A. Sakhare, 2021) medians x {factor} "
              f"(calibrated to ANAROCK Q1 2025 2BHK); PG single/shared/hostel = {RATIOS['pg_single']}/{RATIOS['pg_shared']}/{RATIOS['hostel']} of 1BHK")

    # First pool every Kaggle spelling that maps to the same place, then compute medians once per place.
    pooled, unmatched = {}, []
    for loc, bhks in by_loc.items():
        n = sum(len(v) for v in bhks.values())
        key = ALIASES.get(loc, loc).lower()
        match = FALLBACK_COORDS.get(loc) or FALLBACK_COORDS.get(key) or osm.get(key)
        if not match:
            close = difflib.get_close_matches(key, osm_names, n=1, cutoff=0.85)
            match = osm.get(close[0]) if close else None
        if not match:
            if n >= MIN_ROWS:
                unmatched.append((loc, n))
            continue
        name, lat, lng = match
        p = pooled.setdefault(name, {"lat": lat, "lng": lng, "bhks": defaultdict(list)})
        for bhk, rents_list in bhks.items():
            p["bhks"][bhk].extend(rents_list)

    out = []
    for name, p in sorted(pooled.items(), key=lambda kv: -sum(len(v) for v in kv[1]["bhks"].values())):
        bhks, lat, lng = p["bhks"], p["lat"], p["lng"]
        n = sum(len(v) for v in bhks.values())
        if n < MIN_ROWS or not bhks.get(1):
            continue
        bhk1 = statistics.median(bhks[1]) * factor
        bhk2 = statistics.median(bhks[2]) * factor if bhks.get(2) else None
        r = lambda x: int(round(x / 100.0) * 100)
        out.append({
            "locality": name, "lat": f"{lat:.5f}", "lng": f"{lng:.5f}",
            "pg_shared": r(bhk1 * RATIOS["pg_shared"]), "pg_single": r(bhk1 * RATIOS["pg_single"]),
            "hostel": r(bhk1 * RATIOS["hostel"]), "flat_1bhk": r(bhk1), "flat_2bhk": r(bhk2) if bhk2 else "",
            "rows": n, "source": source, "year": 2025,
        })

    path = DATA / "locality_rents.csv"
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(f"{len(rows)} usable Kaggle rows, {len(by_loc)} raw localities, {len(out)} written to {path.name}")
    print("sample:", ", ".join(f"{o['locality']} 1BHK ₹{o['flat_1bhk']}" for o in out[:8]))
    if unmatched:
        print(f"{len(unmatched)} localities not matched to an OSM place (add to ALIASES if important): "
              + ", ".join(f"{l} ({n})" for l, n in unmatched[:25]))


if __name__ == "__main__":
    main()

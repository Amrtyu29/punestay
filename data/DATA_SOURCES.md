# Real data sources for PuneStay

## In use (2026-10-19)

| Source | Licence | Loaded as | Rows |
|---|---|---|---|
| OpenStreetMap via Overpass | ODbL | 22 service categories in `pois`; PGs / hostels / co-living in `listings` (source `osm`) | ~10,000 places, 110 listings |
| Overture Maps Places, release 2026-09-23.1, via the `overturemaps` CLI | CDLA Permissive 2.0 | PGs / hostels / co-living in `listings` (source `overture`), merged with OSM duplicates (`also_in`) | 410 new listings, 13 merged |
| Kaggle "Rental price of Pune" (A. Sakhare, 2021) | CC0 | `rent_observations` (past flat rents by society) and `data/locality_rents.csv` | 8,391 rents, 1,561 on named buildings |
| ANAROCK Residential Market Viewpoints, Pune Q1 2025 | reference figures only | 2021→2025 uplift factor 1.63 | 5 localities |
| Nominatim (OpenStreetMap) | ODbL | 228 Kaggle locality names geocoded once, cached in `data/overpass_extra/` | 228 |

**Needs a manual step:** Foursquare OS Places (Apache 2.0) moved behind a free sign-in in 2025; the public
S3 bucket now only holds the licence. Sign up, download the Places parquet, and it can be merged the same way
as Overture.

What is still thin is tracked in [COVERAGE.md](COVERAGE.md) (regenerate with `scripts/coverage_report.py`).

## Research sweep (all candidates found)

Found by an automated research sweep on 2026-10-19 (8 domains, 145 candidates). Each confirmed row was opened
by a second, skeptical agent that fetched the URL itself. Unverified rows ran out of budget before the check;
treat them as leads. Licences matter: consultancy PDFs and listing-site tables are reference figures only.

| Verdict | Count |
|---|---|
| confirmed | 19 |
| partial | 3 |
| unverified (verifier did not run) | 123 |

## Confirmed

### Kaggle - Rental price of India's IT Capital, Pune (Anant Sakhare)
- Domain: `rental-listings` · usefulness: **core** · format: zip containing two CSVs (train.csv 1.97 MB, test.csv 0.97 MB; ~2.9 MB uncompressed, ~0.5 MB zipped) · access: portal_page
- Page: <https://www.kaggle.com/datasets/anantsakhare/rental-price-of-indias-it-capital-pune-mh-ind>
- File: <https://www.kaggle.com/api/v1/datasets/download/anantsakhare/rental-price-of-indias-it-capital-pune-mh-ind>
- Licence: CC0 1.0 Public Domain
- What: Pune-only rental listings dataset (v2, July 2021, ~2.9 MB uncompressed). Columns confirmed via Kaggle API: monthly rent (INR), bedrooms, bathrooms, balconies, built-up / super built-up area (sq ft), floor, property age, brokerage, deposit, maintenance, furnishing, flooring, facing, corner, gated community, parking, power backup, availability (family/men/women/bachelors), agreement months, electricity-bill payer, pet-friendly, and a free-text address (geocodable to lat/lon with Nominatim/Photon against the Pune bbox). No lat/lon column. 1,404 downloads, usability 0.97.
- Helps: Only open Pune-specific listing-level rent table found; geocode addresses to seed PG/flat points and compute locality-level rent by BHK for the area-comparison layer.
- Seen: train.csv 10,884 rows + test.csv 5,361 rows (test has rent column too). Columns: bedroom,bathrooms,area,furnishing,avalable_for,address,floor_number,facing,floor_type,gate_community,corner_pro,parking,wheelchairadption,petfacility,aggDur,noticeDur,lightbill,powerbackup,propertyage,no_room,pooja_room,study_room,others,servant_room,store_room,maintenance_amt,brok_amt,deposit_amt,mnt_amt,rent. No lat/lon. 100% of addresses contain "Pune" (format "Project, Locality, , Pune, Maharashtra"); 6,387 distinct addresses, ~1,117 distinct locality tokens; top: Wagholi 454, Hinjewadi 408, Hadapsar 388, Wakad 338, Kharadi 334, Baner 264, Pimple Saudagar 192. BHK mix: 1BHK 4,219 / 2BHK 4,936 / 3BHK 1,504 / 4BHK 202. Rent median 15,000 INR; outliers present (max 123456789, area=0 rows) so cleaning needed.
- Verifier notes: Fetched the Kaggle page (exists, title matches). Kaggle API /datasets/view confirms: CC0 Public Domain, v2 last updated 2021-07-08, 1,404 downloads, usability ~0.97, 2,940,472 bytes. The public API download URL (no login) 302-redirected to a signed storage.googleapis.com archive.zip (signed link expires in ~3 days, so use the kaggle.com/api/v1 URL; it may require a Kaggle API token in some cases, but here it worked with a plain GET). Unzipped and read headers/rows myself: Pune-only listing-level rents, snapshot from mid-2021 (dated), addresses geocodable by locality. Listing-level data appears to have been scraped from a listing portal by the uploader, but it is republished under CC0 on Kaggle. Minor claim corrections: "balconies"/"super built-up area" columns are not present; only a single "area" column.

### ANAROCK Residential Market Viewpoints - Pune Q1 2025 (PDF)
- Domain: `rental-listings` · usefulness: **useful** · format: pdf (PDF 1.7, 3 pages landscape A4, text layer present, exported from PowerPoint 2025-05-15) · access: direct_download
- Page: <https://websitemedia.anarock.com/media/Residential_Market_Viewpoints_Pune_Q1_2025_dc7f7f51df.pdf>
- File: <https://websitemedia.anarock.com/media/Residential_Market_Viewpoints_Pune_Q1_2025_dc7f7f51df.pdf>
- Licence: Copyright ANAROCK; 'for internal circulation and reference purposes', no reproduction - use as attributed reference figures only
- What: 3-page A4 report, text layer extracted and verified. Table 'Key Micro-markets': Avg Quoted Rent (INR/month, 2 BHK ~700-1,000 sf) and Avg Quoted Rate (INR/sf): Wagholi 19,000-29,000 (8,500/sf); Hinjewadi 23,500-33,500 (10,500/sf); Talegaon Dabhade 12,000-16,000 (6,000/sf); Wakad 25,000-32,300 (11,400/sf); Undri 17,000-24,500 (8,400/sf), each with quarterly % change. Also a zone-to-locality mapping (Central: Shivaji Nagar, Sadashiv Peth, Kasba Peth, Prabhat Road, Deccan Gymkhana; East: Wagholi, Kharadi, Hadapsar, Manjari, Wadgaon Sheri, Kalyani Nagar, Magarpatta, Sholapur Rd; West: Kothrud, Hinjewadi, Wakad, Baner, Bavdhan, Pirangut, Pashan, Gahunje; South: Sinhgad Rd, Undri, Kondhwa, Ambegaon Bk, Dhayari, Handewadi, NIBM Annexe; North: Moshi, Talegaon, Chikhali, Ravet, Punawale, Chakan, Lohegaon, PCMC).
- Helps: Published consultancy rent benchmarks for 5 major IT-corridor localities plus an authoritative zone/locality grouping for the area-comparison table.
- Seen: Table 'Key Micro-markets' with 5 rows: Wagholi 19,000-29,000 ₹/mo (+2%), 8,500 ₹/sf (+1%); Hinjewadi 23,500-33,500 (+2%), 10,500 (+1%); Talegaon Dabhade 12,000-16,000 (+2%), 6,000 (+2%); Wakad 25,000-32,300 (+1%), 11,400 (+1%); Undri 17,000-24,500 (+2%), 8,400 (+1%). Zone locality lists: Shivaji Nagar/Sadashiv Peth/Kasba Peth/Prabhat Road/Deccan Gymkhana; Moshi/Talegaon Dabhade/Chikhali/Viman Nagar/Ravet/Punawale/Chakan/Lohegaon/Pimpri Chinchwad; Sinhgad Road/Undri/Kondhwa/Ambegaon Budruk/Dhayari/Handewadi/NIBM Annexe; Wagholi/Kharadi/Hadapsar/Manjari/Wadgaon Sheri/Kalyani Nagar/Magarpatta City/Sholapur Road; Kothrud/Hinjewadi/Wakad/Baner/Bavdhan/Pirangut/Pashan/Gahunje. Plus city-level Q1 2025 stats (16,850 launches, ~16,100 sales, ~81,400 available inventory, ~7,800 ₹/sf avg).
- Verifier notes: Plain GET on the URL returned the PDF (387.7 KB) with no login/form; I extracted the text layer with pypdf and read all 3 pages. Contents match the claim: Pune-specific ANAROCK Q1 2025 report, 5-locality rent/rate table and zone locality lists (zone names Central/East/West/South/North are graphical labels, not in the text layer, but the five grouped lists are present; the north list also includes Viman Nagar, which the claim omitted). Copyright notice confirmed: ANAROCK, internal circulation/reference only, no reproduction, so use only as attributed reference figures, not as a redistributed dataset. No coordinates; localities must be geocoded (e.g. against OSM locality nodes).

### Quikr Homes Pune - 'Price & Rental Trends for Apartments' locality table (HTML)
- Domain: `rental-listings` · usefulness: **useful** · format: html_table · access: manual
- Page: <https://www.quikr.com/homes/city/pune>
- Licence: Quikr copyright; use only as a transcribed reference table with attribution, do not crawl listings
- What: Published HTML table (price column labelled Q3 2025) with 1 BHK / 2 BHK / 3 BHK monthly rent ranges (INR) for ~150 Pune localities, e.g. Kothrud 1BHK 13,140-16,206 / 2BHK 27,450-32,940; Baner 18,920-24,420 / 32,760-40,680; Hinjewadi 17,207-20,881 / 23,490-30,780; Kharadi 2BHK 34,278-42,552; Viman Nagar 20,547-25,014 / 33,820-41,800; Hadapsar 13,072-16,416 / 16,275-20,115; Shivaji Nagar 38,650-56,782 / 27,540-40,460; Katraj 14,240-17,920 / 16,020-19,800; Wakad 2BHK 23,925-29,975; Kothrud/Karve Nagar/Aundh/Erandwane/Camp etc. Some rows are malformed (Wagholi 1BHK, Balewadi 2BHK) and the rent-period header is blank, so treat as indicative. Many rows duplicated with identical values.
- Helps: Most granular locality x BHK rent reference found; transcribe into the area-averages table to fill localities ANAROCK/Knight Frank do not cover.
- Seen: Columns: Area/Locality | Price Q3 2025 per sq ft | % Change (Q2-2025 vs Q3-2025) | 1BHK Rental | 2BHK Rental | 3BHK Rental. Rows seen: Dhanori (2BHK 26365-32670), Undri (1BHK 11040-13320 / 2BHK 14720-17600), Wakad (2BHK 23925-29975 / 3BHK 38362-47740), Kharadi (1BHK 6678-8459 / 2BHK 34278-42552), Baner (1BHK 18920-24420 / 2BHK 32760-40680); many more localities. Wagholi row malformed; some cells blank.
- Verifier notes: Fetched https://www.quikr.com/homes/city/pune (200). Page contains a "Price & Rental Trends for Apartments" HTML table for Pune localities with Q3 2025 price/sq ft plus 1/2/3 BHK monthly rent ranges, matching the claim. No CSV/XLS/GeoJSON download; only three unrelated 2018 PDF research reports. No coordinates; locality names must be geocoded/joined to OSM localities. Rent cells lack currency/period labels, some rows blank or malformed (e.g. Wagholi), so indicative only. License: Quikr T&C section 5 says users agree not to copy/modify/distribute content; not open data. Acceptable only as a manually transcribed, attributed reference table (as the project rule allows for published HTML rent reports), not for crawling or redistribution.

### Symbiosis College of Arts & Commerce - Hostel Details AY 2024-25 (recognised private hostels, PDF)
- Domain: `rental-listings` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://symbiosiscollege.edu.in/assets/pdf/Hostel.pdf>
- File: <https://symbiosiscollege.edu.in/assets/pdf/Hostel.pdf>
- Licence: College notice, public; attribute
- What: 1-page PDF dated 14/06/2024 (text verified). Three college-affiliated private hostels run by MyHostelRoom with full street addresses and Google-Maps links: Capricorn (girls) - above Dadasaheb Darode Hall, Agarkar Rd, near BMCC, Shivajinagar 411004; Galileo (boys) - 382/2 Gokhale Nagar Rd, opp. Manikchand Galleria, Model Colony 411016; Orion (boys) - 17B Atreya Society, Gokhale Nagar Rd, Model Colony 411016. Sharing types, in-room/common amenities, mess, curfew, annual fees (twin Rs 3.6 L, triple Rs 2.3 L, four-sharing Rs 1.8-1.92 L; Orion Rs 1.8-2.4 L), deposit, contact numbers.
- Helps: Three real PG/hostel points with addresses and per-bed annual rent near SB Road/Shivajinagar, plus a template of what a 'college-recognised hostel' record looks like.
- Seen: 3 hostel records (columns: Name, Gender, Address, Location (Google Maps link), Walking/Vehicle distance to Symbiosis SB Road campus, Sharing Type, In-Room Amenities, Common Amenities, Mess, In-Time, Academic Year Hostel Fees, Security Deposit, Legal Fees, Contact Number, Email, Office Timings). Dated 14/6/2024.
- Verifier notes: Fetched the PDF via plain GET (HTTP 200, application/pdf, 165 KB, 1 page) and read its text. Content matches the claim exactly: Symbiosis College of Arts and Commerce "Hostel Details for Academic Year 2024-2025" listing MyHostelRoom Capricorn (girls, Agarkar Rd near BMCC, Shivajinagar 411004), Galileo (boys, 382/2 Gokhale Nagar Rd, Model Colony 411016) and Orion (boys, 17B Atreya Society, Gokhale Nagar Rd 411016), each with Google Maps short link, sharing types, amenities, curfew, annual fees (Capricorn twin 3.6L/triple 2.3L/four 1.8L; Galileo 1.92L four/2.04L triple; Orion 1.8-2.4L), Rs 10,000 deposit, contacts. No coordinates in text; addresses are geocodable and the goo.gl map links resolve to pins. Caveats: only 3 points, commercial operator (MyHostelRoom) prices, and it is a college notice with no explicit licence, so use as reference/attributed sample rather than a dataset.

### Knight Frank India Real Estate - Office & Residential Market H2 2025 (PDF), Pune section pp.70-75
- Domain: `rental-listings` · usefulness: **nice** · format: pdf (80 pages, text layer present, extractable with pypdf) · access: direct_download
- Page: <https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf>
- File: <https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf>
- Licence: Copyright Knight Frank; free public research PDF, cite as reference
- What: 80-page PDF (text layer verified). Pune residential section gives micro-market classification (Central: Koregaon Park, Boat Club Rd, Erandwane, Deccan, Kothrud, Model Colony; East: Viman Nagar, Kharadi, Wagholi, Hadapsar, Dhanori; West: Aundh, Baner, Wakad, Hinjewadi, Bavdhan, Pashan; North: Pimpri, Chinchwad, Moshi, Chikhali, Chakan, Talegaon; South: Kondhwa, Ambegaon, Undri, Dhayari, Warje, Sinhgad Rd) and a 'Residential price movement in select locations' table with INR/sq ft ranges for 18 localities (e.g. Koregaon Park 16,206-19,501; Kothrud 16,606-17,894; Kharadi 10,660-11,004; Hinjewadi 10,033-10,758; Wakad 10,047-13,185; Baner 14,406-16,350; Undri 5,617-6,284; Chakan 3,795-3,857) with 6- and 12-month change. No residential rent figures (only office rents ~INR 78/sq ft/month). H1 2025 edition also exists at https://content.knightfrank.com/research/3013/documents/en/india-real-estate-office-and-residential-market-h1-2025-12239.pdf (not opened).
- Helps: Capital-value proxy and official-looking micro-market grouping for the area-comparison feature; rent can be approximated via yield if needed.
- Seen: Pune residential pp.70-73: micro-market classification table (Central/East/West/North/South, 29 localities) on p.71; 'Residential price movement in select locations' table on p.73 with 18 localities, INR/sq m and INR/sq ft ranges, 12-month and 6-month change (e.g. Koregaon Park 16,206-19,501; Boat Club Rd 20,124-21,182; Kharadi 10,660-11,004; Baner 14,406-16,350; Wakad 10,047-13,185; Hinjewadi 10,033-10,758; Chakan 3,795-3,857; Undri 5,617-6,284); city avg INR 5,016/sq ft. Pune office pp.74-77: business-district classification (CBD, SBD East/West/North, PBD East/West) and office rent ranges INR/sq ft/month (CBD 84-144, SBD East 67-130, SBD West 65-104, PBD East 69-112, PBD West 48-84).
- Verifier notes: Plain GET of the URL returned the PDF (1.8 MB, 80 pages, no login). Extracted text of pages 67-78 with pypdf and read it directly: Pune residential section (pp.70-73) and office section (pp.74-77) match the claim exactly, including micro-market lists and all quoted price figures. No residential rent figures, only capital values (INR/sq ft) and office rents. No coordinates; locality names must be geocoded. Copyright Knight Frank, usable as a cited reference table only. The H1 2025 companion URL was not verified (fetch quota hit).

### PMPML GTFS static feed (croyla/pmpml-gtfs, GitHub)
- Domain: `transit` · usefulness: **core** · format: GTFS zip (agency, routes, trips, stop_times, stops, shapes, calendar .txt) · access: direct_download
- Page: <https://github.com/croyla/pmpml-gtfs>
- File: <https://raw.githubusercontent.com/croyla/pmpml-gtfs/main/pmpml_gtfs_compat.zip>
- Licence: MIT-0
- What: Community-built GTFS for all PMPML buses in Pune + Pimpri-Chinchwad, regenerated monthly from the Apli-PMPML (Chartr) route API. Latest regeneration 2026-10-07 (commit 774f56f). Contains agency.txt, routes.txt (315 routes), trips.txt, stop_times.txt, stops.txt (stop_id, stop_name, stop_lat, stop_lon), shapes.txt (route polylines), calendar.txt. Two zips: pmpml_gtfs.zip (IDs match API) and pmpml_gtfs_compat.zip (directions merged, direction_id set). Outlier stops >10 km from neighbours are dropped automatically. Not affiliated with PMPML.
- Helps: Nearest bus stop layer (stops.txt), bus route lines on the map (shapes.txt), and schedule-based commute time via OpenTripPlanner/r5 or a simple frequency model; replaces the OSM bus-stop POIs with route-linked stops.
- Seen: README lists generated files agency.txt, routes.txt, trips.txt, stop_times.txt, stops.txt ("stop locations and names"), shapes.txt, calendar.txt; route_type 3 (bus). Route/stop counts (e.g. 315 routes) not stated on the page and not verified by me since I did not unzip the file.
- Verifier notes: Fetched repo page, GitHub contents API, commits API and README. Repo exists, described as GTFS for PMPML buses in Pune and Pimpri-Chinchwad, built from Apli-PMPML (Chartr) API prod-pmpml-routesapi.chartr.in. License MIT-0 (LICENSE file 904 B). Latest regeneration commit 774f56f dated 2026-10-06/07 ("regenerate GTFS dataset (2026-10-07)"), previous 2026-09-06, so roughly monthly automated PRs. Two zips present: pmpml_gtfs.zip (4,949,578 B) and pmpml_gtfs_compat.zip (4,855,985 B). HEAD request on the claimed github.com/raw URL returned 200, application/zip, Content-Length 4855985, redirecting to raw.githubusercontent.com, so plain GET works without login. Caveats: stop_times are computed from a default 20 km/h average speed (--speed option), not real timetables, so commute estimates are frequency/speed-based only; I did not download or unzip the file, so stop count and coordinate fields were not inspected directly, though stops.txt with lat/lon is mandatory in GTFS. Not affiliated with PMPML.

### datameet/railways - Indian Railways stations GeoJSON (stations.json)
- Domain: `transit` · usefulness: **core** · format: GeoJSON FeatureCollection (Point features), properties: state, code, name, zone, address · access: direct_download
- Page: <https://github.com/datameet/railways>
- File: <https://raw.githubusercontent.com/datameet/railways/master/stations.json>
- Licence: CC0 1.0
- What: GeoJSON FeatureCollection of all Indian Railways stations as Points with properties state, code, name, zone, address; plus trains.json (train LineStrings with number/name/type/from/to/times/classes) and schedules.json (stop-by-stop timings). Verified Pune-area features: SHIVAJINAGAR SVJR 73.8511,18.5317; KHADKI KK; DAPODI DAPD; KASAR WADI KSWD; PIMPRI PMP; CHINCHVAD CCH; AKURDI AKRD; DEHU ROAD DEHR 73.7342,18.6802; GHORPURI GPR 73.8934,18.5278. Data is old (repo has 3 commits, collected ~2015-16) so schedules are stale, but station points remain valid.
- Helps: Railway station point layer for Pune suburban (Pune-Lonavala, Pune-Daund) and mainline stations; filter by the bbox to get ~15 stations for 'nearest railway station'.
- Seen: All-India stations file (~1.86 MB of JSON). Pune-bbox features seen directly: PUNE JN (PUNE) 73.873086,18.529378; SHIVAJINAGAR 73.851147,18.531738; KHADKI 73.840513,18.563010; DAPODI 73.832799,18.58005; PIMPRI 73.801991,18.622977; CHINCHVAD 73.791392,18.638903; AKURDI 73.764244,18.64812; DEHU ROAD 73.734169,18.680176; GHORPURI 73.893448,18.527821; GHORPURI WEST 73.891790,18.531688; GHORPURI TRANSH 73.898769,18.525924; HADAPSAR 73.927844,18.526887; LONI 74.020514,18.491631 (just outside east edge); URULI 74.13682,18.494237 (outside bbox); LONAVALA 73.407657,18.748883 (outside bbox). Many features have address null.
- Verifier notes: Fetched github.com/datameet/railways: public repo, README states CC0, files README.md, stations.json, trains.json, schedules.json, 3 commits. Fetched raw stations.json via plain GET (no login): valid GeoJSON FeatureCollection, 1,864,683 chars. Paged through the whole file and found the Pune suburban/mainline stations with correct coordinates (listed in record_hint). Data is ~2015-16 vintage; station points valid but schedules stale. Note Kasarwadi (KSWD) claimed by researcher was not spotted in my scan, may exist under different spelling; minor.

### Mobility Database entry mdb-3137 (PMPML) with hosted, validated snapshots
- Domain: `transit` · usefulness: **useful** · format: GTFS schedule zip (agency, calendar, feed_info, routes, shapes, stops, stop_times, trips) · access: direct_download
- Page: <https://mobilitydatabase.org/feeds/gtfs/mdb-3137>
- File: <https://files.mobilitydatabase.org/mdb-3137/mdb-3137-202610080025/mdb-3137-202610080025.zip>
- Licence: Not stated in catalog (upstream repo is MIT-0)
- What: Catalog record for the croyla PMPML feed, labelled 'Community Feed'. MobilityData re-downloads it and runs the GTFS validator (v8.0.1, 'No errors' on the 2026-10-08 snapshot). Service period 2026-10-07 to 2027-04-05, 315 bus routes, includes shapes/headsigns/feed_info. Keeps historical versions. Catalog JSON: catalogs/sources/gtfs/schedule/in-maharashtra-pmpml-gtfs-3137.json (license_url null, bounding box null).
- Helps: Stable, versioned mirror of the PMPML GTFS plus a validation report; use it to pin a known-good feed version for the OSRM/OTP build.
- Seen: 6,745 stops (stops.txt with stop_id,stop_name,stop_lat,stop_lon; e.g. Pune Station Moledina Road 18.5276,73.8732), 315 routes, shapes.txt 6.5 MB, stop_times.txt 16.7 MB; agency = PMPML (Pune Mahanagar Parivahan Mahamandal Limited); feed 2026-10-07 to 2027-04-05, publisher BLRTransit
- Verifier notes: Fetched the Mobility Database page: shows PMPML GTFS Schedule, Community Feed, validator 8.0.1 'No errors', 315 routes, latest dataset 2026-10-08, with plain links to the zip and HTML/JSON validation reports (https://files.mobilitydatabase.org/mdb-3137/mdb-3137-202610080025/report_8.0.1.html). Downloaded the zip via plain GET (4,855,985 bytes), unzipped and inspected: valid GTFS with Pune coordinates. Catalog JSON confirmed: producer URL raw.githubusercontent.com/croyla/pmpml-gtfs/.../pmpml_gtfs_compat.zip, 'latest' mirror https://storage.googleapis.com/storage/v1/b/mdb-latest/o/in-maharashtra-pmpml-gtfs-3137.zip?alt=media, is_official False, bounding box null. No license stated on page or catalog; license depends on upstream croyla/pmpml-gtfs repo (claimed MIT-0, not verified here). Caveat: it is a community-built feed, not official PMPML.

### Pune PMPML Bus Stops Map (KML) - PMC open data via OpenCity
- Domain: `transit` · usefulness: **useful** · format: KML 2.2 (point Placemarks with ExtendedData SchemaData) · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-bus-stops-and-routes>
- File: <https://data.opencity.in/dataset/30dd0c51-61d4-4085-99ab-9a8aec97b329/resource/2c43a9a6-9a58-48dd-8891-e5f3dbe9120c/download/46c96db4-af62-4b84-a479-5a0279a8f44a.kml>
- Licence: Other (Public Domain) per OpenCity; source Pune Municipal Corporation
- What: KML 2.2 point layer of PMPML bus stops originally published on opendata.punecorporation.org; each Placemark carries a GTFS-style SchemaData: stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding. Several thousand stops; coverage is the whole PMPML area (points from lon 73.57 to 74.15, lat 18.34 to 18.68, so clip to the city bbox). Dataset created 2024-01-25, last updated 2025-11-25. Same dataset also has 'Pune PMPML Bus Depots Map' (KML, 7.4 KiB) and 'Pune PMPML Bus Routes List' (CSV, ~700 rows: Route ID, Route Description, Route Description Marathi, Kilometer; no coordinates).
- Helps: Official PMC snapshot of stop locations with stop codes; cross-check/fill gaps against the GTFS stops.txt, and the routes CSV gives route length (km) per route ID. Depots KML: https://data.opencity.in/dataset/30dd0c51-61d4-4085-99ab-9a8aec97b329/resource/b5bad569-1c37-4dd7-9267-993a6edf8a1b/download/17f84424-1769-45a2-84d5-76f0089f7e3a.kml ; Routes CSV: https://data.opencity.in/dataset/30dd0c51-61d4-4085-99ab-9a8aec97b329/resource/433caa89-75e2-474d-b5d6-db8fd7a3171d/download/c91c0878-b4f9-419f-8d7c-97eb6c7a9083.csv
- Seen: Schema S_stops_IISIDDIIIIII: stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding. Sample stops: Forest Office Road (73.63158,18.51983), Kusalkar Putala (73.82708,18.52889), Gangadham Corner (73.87253,18.48015); stop_ids run up to ~32764. File text ~5.07M chars, so likely several thousand stops.
- Verifier notes: Fetched the OpenCity dataset page: title "Pune Bus Stops and Routes", source Pune Municipal Corporation (opendata.punecorporation.org), license Other (Public Domain), created 2024-01-25, updated 2025-11-25; three resources (Bus Stops KML, Bus Depots KML, Bus Routes CSV) with plain download links. Fetched the Bus Stops KML by plain GET: valid KML 2.2 (Bus_stops.kml), one folder "stops" of Placemarks with GTFS-style fields and Point coordinates; file closes properly with </kml>. Coordinates mostly in Pune but extend beyond the city bbox (lon 73.57-74.15, lat 18.34-18.73), so clip. Did not open the depots KML or routes CSV, but their links are listed on the same page.

### Wikidata SPARQL: Pune Metro stations and railway stations with coordinates
- Domain: `transit` · usefulness: **useful** · format: SPARQL JSON (application/sparql-results+json); CSV available via format=csv · access: api
- Page: <https://query.wikidata.org/sparql?format=json&query=SELECT%20%3Fitem%20%3FitemLabel%20%3Fcoord%20%3Fcode%20WHERE%20%7B%20SERVICE%20wikibase%3Abox%20%7B%20%3Fitem%20wdt%3AP625%20%3Fcoord%20.%20bd%3AserviceParam%20wikibase%3AcornerSouthWest%20%22Point(73.7%2018.4)%22%5E%5Egeo%3AwktLiteral%20.%20bd%3AserviceParam%20wikibase%3AcornerNorthEast%20%22Point(74.0%2018.7)%22%5E%5Egeo%3AwktLiteral%20.%20%7D%20%3Fitem%20wdt%3AP31%2Fwdt%3AP279*%20wd%3AQ55488%20.%20OPTIONAL%20%7B%20%3Fitem%20wdt%3AP296%20%3Fcode%20%7D%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D>
- File: <https://query.wikidata.org/sparql?format=json&query=SELECT%20%3Fitem%20%3FitemLabel%20%3Fcoord%20%3Fcode%20WHERE%20%7B%20SERVICE%20wikibase%3Abox%20%7B%20%3Fitem%20wdt%3AP625%20%3Fcoord%20.%20bd%3AserviceParam%20wikibase%3AcornerSouthWest%20%22Point(73.7%2018.4)%22%5E%5Egeo%3AwktLiteral%20.%20bd%3AserviceParam%20wikibase%3AcornerNorthEast%20%22Point(74.0%2018.7)%22%5E%5Egeo%3AwktLiteral%20.%20%7D%20%3Fitem%20wdt%3AP31%2Fwdt%3AP279*%20wd%3AQ55488%20.%20OPTIONAL%20%7B%20%3Fitem%20wdt%3AP296%20%3Fcode%20%7D%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D>
- Licence: CC0 1.0
- What: Live query confirmed: 43 unique stations inside the project bbox with WGS84 coordinates: 28 Pune Metro stations (all operational Purple + Aqua stations, e.g. Vanaz 73.8052,18.5072; PCMC Bhavan 73.8055,18.6269; Swargate 73.8577,18.4996; Khadki 73.8415,18.5621) and 15 Indian Railways stations (Pune Jn, Shivajinagar, Khadki, Dapodi, Kasarwadi, Pimpri, Chinchwad, Akurdi, Dehu Road, Ghorpuri, Hadapsar, Manjari Budruk, Sasvad Road, etc.). A second query (P16/P81 on Pune Metro Q3595697) returns the same metro stations with their line label (Purple/Aqua; District Court and Shivaji Nagar also tagged Pink). Pink Line (Line 3) stations have no coordinates in Wikidata yet.
- Helps: Canonical station list with line membership and names for the 'nearest metro' feature and for labelling the metro layer; also a quick railway-station point layer. Returns JSON/CSV directly from the endpoint (add &format=csv).
- Seen: 171 bindings (duplicates due to multiple P625/P296 values), 43 unique items: 28 Pune Metro stations + 15 railway stations. Fields: item, itemLabel, coord (WKT Point lon lat), code. Sample: Vanaz metro station Point(73.8052 18.5072); PCMC Bhavan metro station Point(73.8055 18.6269); Shivaji Nagar metro station Point(73.8495 18.5327); Pune Railway Station metro station Point(73.8726 18.5297).
- Verifier notes: Fetched the live SPARQL URL (plain GET, no login). Returned valid JSON with no errors: 171 rows, 43 unique stations inside the Pune bbox with WGS84 coordinates, matching the claim. Rows are duplicated (same station repeated) so dedupe by item QID or add DISTINCT. Wikidata data is CC0. Coordinates are WKT lon lat; parse with ST_GeomFromText in PostGIS. Pink Line stations without coordinates will be absent, as claimed.

### Wikipedia: List of Pune Metro stations + Pink Line (Pune Metro) article
- Domain: `transit` · usefulness: **useful** · format: html_table (wikitext via action=raw; no coordinates) · access: portal_page
- Page: <https://en.wikipedia.org/wiki/List_of_Pune_Metro_stations>
- File: <https://en.wikipedia.org/w/index.php?title=List_of_Pune_Metro_stations&action=raw>
- Licence: CC BY-SA 4.0
- What: 72 stations with line and status: 28 operational (Aqua 16, Purple 13, 2 interchanges) and 44 under construction, including the full 23-station Pink Line (Hinjawadi/Maan - Shivajinagar - District Court). The Pink Line article (https://en.wikipedia.org/wiki/Pink_Line_(Pune_Metro)) gives the ordered station list (Maan, Maan-MIDC Circle Phase-II, Maan Bus Depot, Hinjawadi Phase-II Circle-II/-I, Padmabhushan Chowk, Shivaji Maharaj Chowk Hinjawadi, Hinjawadi Phase-I, Wakad Chowk, Sports Complex Mahalunge, Mitcon Balewadi, R K Laxman Museum Balewadi, Balewadi High Street, Balewadi Phata, Baner Gaon, Baner Pashan Link Road, Aundh, Sakal Nagar, SPPU, Bhosalenagar-RBI, Agriculture College, Shivaji Nagar, District Court), length 23.3 km, operator Keolis, phase 1 (12 stations Maan-Balewadi) CMRS-cleared, expected opening Nov/Dec 2026, phase 2 March 2027. No coordinates in either article.
- Helps: Status/opening-date attributes and the planned-extension station list (Hinjewadi line) for a 'planned metro' layer; join names to OSM/Wikidata points.
- Seen: 72 stations (28 operational, 44 under construction); columns: Metro Station (English/Marathi), Line, Opened, Layout, Notes, Ref. Pink Line article: 23 ordered stations Maan to District Court, 23.3 km, operator Keolis, phase 1 Nov/Dec 2026, phase 2 March 2027.
- Verifier notes: Fetched both Wikipedia pages. List page has two tables (operational / under construction) with 72 stations incl. all Pink Line stations; no lat/lon in tables. Pink Line page (edited 29 Sep 2026) gives the ordered 23-station list, length, operator and opening dates (infobox and table dates conflict slightly: Nov vs Dec 2026). Plain GET works; wikitext available via action=raw. CC BY-SA 4.0. Coordinates must be joined from OSM/Wikidata as claimed.

### OpenStreetMap Pune Metro route relations and Line 3 construction geometry
- Domain: `transit` · usefulness: **useful** · format: OSM XML (API 0.6; append .json for JSON) · access: api
- Page: <https://www.openstreetmap.org/relation/13994916>
- File: <https://www.openstreetmap.org/api/0.6/relation/13917122/full>
- Licence: ODbL 1.0
- What: Network relation 13994916 'Pune Metro' (wikidata Q3595697) with member route relations 13916711 (Aqua Line: Vanaz - Ramwadi) and 13917129 (Purple Line: PCMC Bhavan - Phugewadi & Civil Court - Shivaji Nagar; note the relation name is stale, the line now runs to Swargate). Pink Line / Line 3 is mapped as ways named 'Pune Metro Line 3 (Pink Line)' tagged railway=subway + construction=yes, bridge=viaduct, opening_date=2026 (e.g. way 1480738521); Line 3 station nodes already exist, e.g. Wakad Chowk node 7944597702 railway=station at 18.5903, 73.7576.
- Helps: Line geometry (not POIs) for drawing Purple/Aqua alignments and the under-construction Hinjewadi line; fetch the relation /full via the OSM API or by relation ID. Only coordinate source found for all Line 3 stations; note construction-tagged ways will be missed by a plain railway=station POI query.
- Seen: Network relation 13994916 (name=Pune Metro, type=network, wikidata=Q3595697) -> route_masters 13916711 (Aqua Line: Vanaz <-> Ramwadi; routes 13916710, 13916704) and 13917129 (Purple Line route_master; routes 13917122 Swargate->PCMC Bhavan and 13917123 reverse, each ~14 stop nodes + 16 ways). relation/13917122/full returned 211 nodes, 16 ways, 1 relation (~55 KB) with station coords e.g. Swargate 18.49975,73.85741; PCMC Bhavan 18.62930,73.80327; Shivaji Nagar 18.53215,73.84960. Node 7944597702 = Wakad Chowk, railway=station, construction=subway, operator=PMRDA, opening_date=2026 at 18.5902986,73.7575587. Way 1480738521 tags: railway=subway, construction=yes, construction:railway=subway, bridge=viaduct, name=Pune Metro Line 3 (Pink Line).
- Verifier notes: Fetched all claimed IDs via the OSM API; all exist and match the claim. Caveat: the researcher's direct_download_url (relation/13917129/full) is a route_master, so /full returns only the 3 relations with NO node/way geometry. Use the child route relations instead: 13917122 or 13917123 (Purple), 13916710 or 13916704 (Aqua) with /full to get coordinates. Line 3 (Pink) has no route relation yet; its ways/stations must be collected by tag query (railway=subway + construction=yes, or construction=subway stations). License ODbL 1.0, plain GET, no login.

### Unofficial Indian Railways GTFS (Neo2308/indianrailways-gtfs; Mobility Database mdb-2867)
- Domain: `transit` · usefulness: **useful** · format: GTFS zip (4.17 MB zipped, ~18 MB unzipped); also unzipped txt files at https://raw.githubusercontent.com/Neo2308/indianrailways-gtfs/main/gtfs/gtfs/stops.txt etc. · access: direct_download
- Page: <https://mobilitydatabase.org/feeds/gtfs/mdb-2867>
- File: <https://files.mobilitydatabase.org/mdb-2867/mdb-2867-202608310026/mdb-2867-202608310026.zip>
- Licence: Not stated (unofficial community feed)
- What: All-India train schedule GTFS (10,594 rail routes, stops.txt with station coordinates, bbox 68.98-95.73 E / 8.09-34.26 N). Built from an API snapshot around 9 Nov 2025; marked 'Unofficial data'; validator shows 2 errors. Mobility Database hosts versioned copies (latest 2026-08-31). Source repo: https://github.com/Neo2308/indianrailways-gtfs (direct zip https://github.com/Neo2308/indianrailways-gtfs/raw/refs/heads/main/gtfs/gtfs.zip). No licence stated.
- Helps: Schedule-based rail legs (Pune-Lonavala locals, Pune-Daund DEMU, mainline) in the commute-time router if you run OTP alongside the PMPML GTFS; filter to agency/stops in the bbox.
- Seen: stops.txt header: stop_id,stop_code,stop_name,tts_stop_name,stop_desc,stop_lat,stop_lon,zone_id,stop_url,location_type,parent_station,stop_timezone,wheelchair_boarding,level_id,platform_code,stop_access. Pune-bbox stations seen: PUNE JN (18.529178,73.872886), SHIVAJI NAGAR (18.532148,73.851557), KHADKI (18.56311,73.840613), KASAR WADI (18.609889,73.818984), PIMPRI (18.6231,73.8021), AKURDI (18.6484,73.7645), HADAPSAR (18.526817,73.927774), MANJARI BUDRUK (18.512249,73.971634); just outside bbox: LONI, URULI, TALEGAON, LONAVALA. agency.txt: single agency 'Indian Railways'. Mobility Database page: 10,594 rail routes, validator v8.0.1 2 errors.
- Verifier notes: Fetched the Mobility Database page (exists, community feed labelled 'Unofficial data', no license stated), the GitHub repo (Go tool exporting GTFS from an unnamed API-key train API; no LICENSE file), and the unzipped stops.txt/agency.txt/feed_info.txt on raw.githubusercontent.com. HEAD on both zip URLs returned HTTP 200 application/zip, 4,173,379 bytes (identical file), plain GET, no login. Pune stations with coordinates are present (see record_hint). Caveats: (1) feed_info.txt says feed_start_date 20260830, feed_end_date 20260930, so the calendar is already expired as of 2026-10-19; for OTP/routing you would need to extend calendar dates or re-generate; check for a newer Mobility Database version. (2) No license at all, so legal reuse is unclear; the original upstream is an unnamed proprietary train API, not an official Indian Railways open release. Station coordinates and the Pune suburban (Pune-Lonavala) stop list are the usable part; treat schedules as unofficial reference only. The 50 MB size estimate in the claim was wrong (4.2 MB).

### Pune auto-rickshaw fare revision (RTA Pune, effective 1 Sep 2026) - Punekar News explainer
- Domain: `transit` · usefulness: **useful** · format: HTML news article (prose, no table, no data file) · access: portal_page
- Page: <https://www.punekarnews.in/?p=243770>
- Licence: News article (use the fare facts, not the text)
- What: Reports the Pune RTO press note on the Pune/Pimpri-Chinchwad auto fare revision approved at the 3 Aug 2026 Pune RTA meeting: minimum Rs 30 for first 1.5 km (was 25), Rs 20 per additional km (was 17), 25% night surcharge 00:00-05:00 inside PMC/PCMC limits, 40% surcharge 23:00-05:00 in rural areas, Rs 3 per luggage item >= 60x40 cm; temporary tariff cards valid until 28 Feb 2027, meters to be recalibrated by then. Corroborated by Free Press Journal (https://www.freepressjournal.in/pune/25-night-surcharge-on-autos-from-midnight-to-5-am-in-pune-3-for-luggage) and The Bridge Chronicle. No official PDF is linked; Pune RTO does not publish the card online (see dead ends).
- Helps: Parameters for the auto-rickshaw fare estimator: fare = 30 + 20 * max(0, km - 1.5), rounded to the rupee, x1.25 between midnight and 5 am.
- Seen: Fare parameters seen on both pages: min fare Rs 30 for first 1.5 km (was 25); Rs 20 per additional km (was 17); 25% night surcharge 00:00-05:00 inside PMC/PCMC limits; 40% surcharge 23:00-05:00 in rural areas; Rs 3 per luggage item >= 60x40 cm; effective 1 Sep 2026; temporary tariff cards valid until 28 Feb 2027, meters recalibrated free in that window.
- Verifier notes: Fetched the Punekar News URL (article by Mubarak Ansari, dated 2 Sep 2026) and the Free Press Journal corroborating article (3 Sep 2026). Both exist and report the same Pune/PCMC RTA fare figures, matching the claim exactly. Neither links an official RTO press note or PDF, so there is no downloadable data file; the "data" is a handful of fare constants to hard-code in the fare estimator. Web search budget was exhausted so I could not look for an official Pune RTO/RTA PDF; treat the figures as news-sourced and cite both articles.

### India railway stations + railway network GeoJSON (gist by sankalpsharmaa, forked by gvensan)
- Domain: `transit` · usefulness: **nice** · format: geojson (FeatureCollection, CRS84; stations = Point, network = MultiLineString) · access: direct_download
- Page: <https://gist.github.com/gvensan/f9657a03cfe25b8efd34ee7351446949>
- File: <https://gist.githubusercontent.com/gvensan/f9657a03cfe25b8efd34ee7351446949/raw/railway_network.geojson>
- Licence: Not stated
- What: Three files: india_railway_stations.geojson (station Points with state, code, name, zone, address; same schema as datameet) and railway_network.geojson (MultiLineString track network with properties such as operational status and track type), plus a README. Created Oct 2025 as a fork; no licence stated.
- Helps: Track-line geometry to draw the suburban rail corridors on the map (clip to bbox); stations file duplicates datameet.
- Seen: railway_network.geojson: 3.44 MB, 2012 MultiLineString features, properties FID, FID_rail_d, F_CODE_DES ("Railroad"), EXS_DESCRI ("Operational"), FCO_DESCRI ("Single"/track type), ISO, Shape__Length; ~50 vertices fall inside the Pune bbox. india_railway_stations.geojson: 4.02 MB, 8697 Point features, properties FID, state, code, name, zone, address, lat, long; Pune-area stations present: PUNE JN, SHIVAJINAGAR, KHADKI, KHADKI BAZAR, HADAPSAR, PIMPRI, AKURDI.
- Verifier notes: Fetched the gist page and both raw files (plain GET, HTTP 200, no login). The gist (forked Oct 2025 from sankalpsharmaa) holds a markdown description plus two GeoJSON files; no licence stated. Network file contains India-wide track lines with ~50 vertices inside the Pune bbox (clip needed); stations file contains 7 Pune-area stations. The gist.github.com/.../raw/<sha>/ URL 301-redirects to gist.githubusercontent.com; use the githubusercontent URL directly. Stations file: https://gist.githubusercontent.com/gvensan/f9657a03cfe25b8efd34ee7351446949/raw/india_railway_stations.geojson . Caveat: no licence, and the network attributes (FID_rail_d, F_CODE_DES, ISOCOUNTRY) look like a repackaged VMAP0/DIVA-GIS-style dataset of unknown vintage, so treat as reference-only or prefer OSM railway=rail for authoritative geometry.

### Wikipedia: Pune Suburban Railway (station lists with codes)
- Domain: `transit` · usefulness: **nice** · format: html_table (wikitext via action=raw, or JSON via MediaWiki API) · access: portal_page
- Page: <https://en.wikipedia.org/wiki/Pune_Suburban_Railway>
- File: <https://en.wikipedia.org/w/index.php?title=Pune_Suburban_Railway&action=raw>
- Licence: CC BY-SA 4.0
- What: Ordered station lists: Pune-Lonavala line, 18 stations with codes (PUNE, SVJR, KK, DAPD, KSWD, PMP, CCH, AKRD, DEHR, BGWI, GRWD, TGN, VDN, KNHE, KMST, MVL, LNL, KDL) and Pune-Daund-Baramati DEMU line, 16 stations (Pune, Ghorpuri, Hadapsar, Manjari Budruk, Loni, Uruli, Yevat ... Daund ... Baramati). Operator Central Railway. No coordinates or per-station distances.
- Helps: Code list to filter the all-India station GeoJSON/GTFS down to the stations that actually have suburban service, and to order them along each line.
- Seen: Pune-Lonavala: 18 stations with codes PUNE, SVJR, KK, DAPD, KSWD, PMP, CCH, AKRD, DEHR, BGWI, GRWD, TGN, VDN, KNHE, KMST, MVL, LNL, KDL. Pune-Daund-Baramati: 16 stations (Pune Jn, Ghorpuri, Hadapsar, Manjari Budruk, Loni, Uruli, Yevat, Khutbav, Kedgaon, Kadethan, Patas, Daund Jn, Maladgaon, Shirsai, Katphal, Baramati), no codes.
- Verifier notes: Fetched the Wikipedia article; it exists and contains exactly the two ordered station lists claimed (Lonavala line with station codes, Daund/Baramati line without codes). No per-station coordinates or km distances (only system length 63 km). Wikipedia text is CC BY-SA 4.0 standard license (footer not read, but site-wide policy). Not a data file: it is an HTML table, but plain-GET wikitext/API access works without login. Useful only as a code/order reference to filter a station GeoJSON/GTFS, as claimed.

### PMPML official website - embedded bus-stop code list, route timetable PDF, fare press notes
- Domain: `transit` · usefulness: **nice** · format: HTML <select> option list (stop name EN - Marathi (CODE), no coordinates) + PDF timetable (text-extractable, 65 pages) + PDF press notes (Marathi, 1 page) · access: portal_page
- Page: <https://pmpml.org/>
- File: <https://pmpml.org/assets/schedule/1791528296451958dd6915d7456b897a67f84f0fae.pdf>
- Licence: PMPML (govt company) site, no explicit licence
- What: Homepage embeds a 'Select bus stop' list of several thousand stops as 'NAME - मराठी नाव (CODE)' (e.g. KADAM VASTI (KDMVST)), no coordinates. Regular-bus page https://pmpml.org/regular_buses states ~389 routes and links a route timetable PDF https://pmpml.org/assets/schedule/1791528296451958dd6915d7456b897a67f84f0fae.pdf (0.95 MB, text not verified). Press note on the km-based stage fare structure effective 1 June 2025 (11 stages for 1-80 km in 5/10 km steps; Marathi) https://pmpml.org/assets/media_center/1748602187f2ca3bf0fe943d1dac8508bf92491765.pdf and the RTA/BOD resolution scan https://pmpml.org/assets/media_center/1752667283c33f8d08f19270230784bbe11139240f.pdf (approves fare revision; also notes 695 approved auto-rickshaw stands in Pune city, list only as annexure). Monthly operations statistics PDFs under /assets/media_center/. Site map confirms no GTFS/API/open-data/route-map pages.
- Helps: Stop codes to join GTFS stop names to official PMPML codes; fare stage structure (news: Rs 10 for 0-5 km, Rs 20 for 5-10 km, ...) for a bus fare estimate.
- Seen: Homepage: 8,844 <option> entries = 4,422 unique stop codes (two from/to selects), e.g. "10 WA MILE WADKI - १० वा मैल वडकी (10WWD)", "KADAM VASTI - कदम वस्ती (KDMVST)". Timetable PDF: 65 pages, rows of SCHEDULE / ROUTE NO. / ROUTE (e.g. "PUNE STATION TO NDA GATE", "DIGHI TO NASHIK PHATA METRO STATION", "METRO33 UP") followed by departure-time lists; no stop sequences, no coordinates. 121 media_center PDF links on homepage.
- Verifier notes: Fetched https://pmpml.org/ (plain GET, HTML): parsed 4,422 unique PMPML stop codes with English+Marathi names; no lat/lon, no GTFS/API/open-data links. Fetched https://pmpml.org/regular_buses: states 389 routes and links the timetable PDF. Downloaded timetable PDF (946 KB, 65 pages, pypdf text extraction works): per-route origin-destination names and departure times only. Downloaded fare press note PDF (338 KB, 1 page, Marathi): text extracts as garbled glyphs due to font encoding, so the 11-stage fare table was not verified from the file; content type/date not confirmed by me. No explicit licence on site. Useful mainly as a stop-code/name lookup to join with OSM/GTFS stop names and as route headway reference; stops must be geocoded separately.

### Pune PMPML Annual Data (OpenCity mirror of PMC open data)
- Domain: `transit` · usefulness: **nice** · format: PDF (5 pages, text-extractable) + CSV + 2 XLSX · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-pmpml-annual-data>
- File: <https://data.opencity.in/dataset/e92df6b3-b7a1-4c5d-a706-e1838ed31edb/resource/5911ffae-7f4b-4094-9dc8-6c7cc35dc328/download/dd004344-2f12-48f8-84ef-374ddeba1a69.pdf>
- Licence: Other (Public Domain)
- What: Non-spatial statistics: PMPML number of buses 2015-16 to 2019-20 (CSV), annual reports 2019-20 and 2020-21 (XLSX), and 'PMPML Annual Statistics for 2023-24 and 2024-25' (PDF: fleet, routes, km, passengers, revenue).
- Helps: Context figures (fleet size, daily ridership) for the project report; not needed by any map feature.
- Seen: PDF: "PMPML Statistical Report for the year 2023-24 & 2024-25" — rows like Total vehicles held (995 / 1,001 own+PPP; 2,066 / 1,933 incl. hired), avg vehicles on road per day (1,658 / 1,558), schedules sanctioned (1,823 / 1,784), effective KMs by fuel type, etc. CSV: 5 rows, fields City Name, Population (lakh), Year, Presence of organized bus transport, No. of Bus Service Providers, Total No. of Buses (1447/1382/1425/1373/1383 for 2015-16..2019-20), No. of disable-friendly bus stops.
- Verifier notes: Fetched the OpenCity dataset page: title "Pune PMPML Annual Data", publisher Pune Municipal Corporation, license "Other (Public Domain)", 4 resources (CSV buses 2015-16 to 2019-20; XLSX annual reports 2019-20 and 2020-21; PDF statistics 2023-24 & 2024-25). Downloaded the PDF via plain GET (220 KB, 5 pages) and extracted text with pypdf: it is PMPML Swargate Pune statistical report with fleet, schedules, km, and (per claimed scope) passenger/revenue rows. Downloaded the CSV via plain GET and saw its 5 rows. XLSX links exist on page but were not opened. Entirely non-spatial; useful only as context figures. CSV direct link: https://data.opencity.in/dataset/e92df6b3-b7a1-4c5d-a706-e1838ed31edb/resource/c6da387f-51e9-44f9-b678-ad618088964f/download/d51181ee-c8d6-4356-ade3-0410565bb002.csv

### Comprehensive Mobility Plan for Pune City 2008 (PMC, via OpenCity)
- Domain: `transit` · usefulness: **nice** · format: pdf (text-based, PDF 1.4, 179 pages) · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-comprehensive-mobility-plan>
- File: <https://data.opencity.in/dataset/bb6b3dc4-6ff5-42bf-b41f-3d823a4e8ef8/resource/e883b43e-aaa8-4411-bfa8-860f05154f5d/download/9d5dca7b-5ddb-4c91-b9f8-cae4acbef71c.pdf>
- Licence: Other (Public Domain)
- What: PDF of the 2008 CMP (source pmc.gov.in), tagged Mobility; contains proposed BRT/metro/road network maps and travel-demand figures. Old but official.
- Helps: Background reference for the write-up; no machine-readable geometry.
- Seen: 179 pages. Text extracted: title "Comprehensive Mobility Plan for Pune City - Pune Municipal Corporation"; chapters 1 Introduction, 2 Study Methodology, 3 study-area/economic profile (PCMC MIDC, Chakan, SEZ), 5 Past Studies (RITES MRTS 2001, Span CTTS 2003), 6 travel-demand model (Table 6.7 Validation-Trips, 6.8 Mode-wise trip length, 6.9 speeds, 6.10 population projections, 6.11 employment).
- Verifier notes: Fetched the OpenCity dataset page (CKAN): org Pune Municipal Corporation, source pmc.gov.in, license "Other (Public Domain)", tag Mobility, one PDF resource. HEAD on the download URL returned 200 application/pdf, Content-Length 34,495,353 bytes (34.5 MB, not 20 MB), no login/redirect. Downloaded the file and parsed with pypdf: 179 pages of selectable text, confirmed as the PMC CMP 2008 for Pune. Useful only as a narrative/tabular reference (travel demand, mode shares, proposed networks); no GIS geometry or machine-readable layers. Maps are embedded images.

## Partial

### Pune Metro official site (Maha-Metro) - fare chart, route map, timetable
- Domain: `transit` · usefulness: **nice** · format: pdf (image-only, no text layer); avif images for fare chart · access: portal_page
- Page: <https://www.punemetrorail.org/fare_chart.aspx>
- File: <https://www.punemetrorail.org/download/zoom/route-map.pdf>
- Licence: Government of Maharashtra / Maha-Metro site, no explicit licence
- What: Station-to-station fare lookup with a 29-entry station dropdown (PCMC ... Swargate; Vanaz ... Ramwadi) but fares are rendered only as AVIF images (Fare-Chart-E-Web.avif / Fare-Chart-M-web.avif). Schematic route map PDF (two 1280x500 JPEG images: PCMC-Swargate and Vanaz-Ramwadi, with Range Hill depot) at https://www.punemetrorail.org/download/zoom/route-map.pdf ; timetables https://www.punemetrorail.org/download/zoom/Time-Tebal-new-1.pdf and -2.pdf. Wikipedia's Pune Metro article (https://en.wikipedia.org/wiki/Pune_Metro) carries a Purple Line origin-destination fare matrix (Rs 10-30, e.g. PCMC Bhavan to Swargate Rs 30) usable as a reference table.
- Helps: Reference for metro fare estimates and official station naming; the schematic map is for QA only, not georeferenced.
- Seen: Fare page dropdown lists 29 stations: PCMC, Sant Tukaram Nagar, Nashik Phata (Bhosari), Kasarwadi, Phugewadi, Dapodi, Bopodi, Khadki, Shivaji Nagar, District Court, Kasba Peth, Mahatma Phule Mandai, Swargate, Vanaz, Anand Nagar, Paud Phata, S.N.D.T. College, Garware College, Deccan Gymkhana, Chhatrapati Sambhaji Udyan, PMC, R.T.O, Pune Railway Station, Ruby Hall Clinic, Bund Garden, Yerwada, Kalyani Nagar, Ramwadi. Wikipedia Purple Line fare matrix e.g. PCMC Bhavan-Swargate Rs 30, Dapodi-Shivaji Nagar Rs 25, Shivaji Nagar-District Court Rs 10.
- Verifier notes: Fetched all URLs. fare_chart.aspx exists (Maha-Metro site), has From/To dropdown of 29 stations but the fare field is blank in plain HTML; the fare table is served only as images (assets/images/Fare-Chart-E-Web.avif, 161 KB, confirmed as image/avif, English; -M-web.avif Marathi). route-map.pdf: 154 KB, PDF 1.7 containing two 1280x500 JPEGs, no text layer. Time-Tebal-new-1.pdf (72.5 KB) and -2.pdf (71.8 KB): single 1000x1000 JPEG each, no text, Nitro Pro 2023-07-08. Wikipedia Pune Metro article confirmed to have a Purple Line (Line 1) origin-destination fare matrix in rupees and full station lists for both lines (Aqua Line table lists 29 stations incl. planned extensions). All files are plain-GET, no login. Verdict partial because all official files are image-only and need OCR/manual transcription; no coordinates anywhere, no explicit licence. Useful only as a reference table for fares and official station naming; station coordinates should still come from OSM.

### Maharashtra Motor Vehicle Dept auto-rickshaw tariff cards (MMRTA / Mumbai region) - fare-formula template
- Domain: `transit` · usefulness: **nice** · format: PDF, 4 pages, scanned images only (one JPEG ~3470x2465 per page, no text layer; needs OCR or manual transcription) · access: direct_download
- Page: <https://transport.maharashtra.gov.in/Site/Common/ViewPdfList.aspx?Doctype=1d1f28f9-a4e5-4b09-ab8b-1d4576adca18>
- File: <https://transport.maharashtra.gov.in/Site/Upload/GR/Autorickshaw_Tariff_Card.pdf>
- Licence: Government of Maharashtra publication
- What: Official 'Auto Rickshaw and Taxi Fare Revision' list. Two auto cards: Autorickshaw_Tariff_Card.pdf dated 01/09/2026 (min Rs 27, Rs 18.22/km, 25% midnight-5am, luggage Rs 6, waiting 10% of per-km fare per minute; signed Secretary MMRTA Region, i.e. Mumbai, 4 pages, distance table 1.5-30 km in 0.1 km steps) and 'Auto Rickshaw Tariff Card.pdf' w.e.f. 01/02/2025 (min Rs 26, Rs 17.14/km). Both are Mumbai-region cards, NOT Pune, but they document the exact state fare-calculation rule: fare = distance x per-km rate, rounded to nearest rupee, midnight surcharge 25%.
- Helps: Shows the official rounding/surcharge/waiting-charge method and the tariff-card layout to replicate for Pune with the Rs 30 / Rs 20 parameters.
- Seen: Distance table 1.50-30.00 km in 0.10 km steps (286 rows), columns: Distance, Old fare, Revised fare, Midnight old, Midnight revised. Header: MINIMUM FARE Rs 27.00; Rs 18.22/km rounded to nearest rupee; 25% extra 00:00-05:00. Footer: fare = distance x per-km rate rounded (49 paise down / 50 up); luggage Rs 6 per package >60x40 cm; waiting 10% of per-km fare per minute. Signed 'Secretary MMRTA Region'.
- Verifier notes: Fetched the ViewPdfList catalog page (reachable, last reviewed 16-10-2026): lists 5 tariff cards incl. 'Auto Rickshaw Tariff Card.pdf' (30/01/2025, 0.52 MB) and 'Autorickshaw_Tariff_Card.pdf' (01/09/2026, 2.43 MB); no Pune/PMRTA document on the page. Downloaded the 2.4 MB PDF via plain GET and extracted/viewed page images: contents match the claim exactly and it is the Mumbai (MMRTA) card, not Pune. Useful only as a reference for the state fare-calculation method and card layout; it contains no Pune fares and no spatial data. Marked partial because the file is real and open but is not Pune data and is image-only.

### PMRDA GIS portal (gis.pmrda.gov.in) and PMRDA Metro Line 3 page
- Domain: `transit` · usefulness: **nice** · format: web viewer behind login (no file/service exposed anonymously) · access: manual
- Page: <https://gis.pmrda.gov.in/>
- Licence: Public information only per PMRDA disclaimer; no data licence
- What: PMRDA launched a public GIS portal on 6 Aug 2026 (press note https://www.pmrda.gov.in/wp-content/uploads/2026/08/PMRDA-Unveils-GIS-Portal-Planning-Data-Now-Accessible-at-a-Click-1.pdf) advertising layers for Pune Metro corridors, railway networks, MSRDC/PMRDA ring roads, PWD roads, TOD zones around metro stations, municipal/village boundaries and flood lines. The root page opened shows only About/Contact/Validate Document/Login and a 'Geo Portal' disclaimer; no map viewer, layer list, download, ArcGIS REST (/server/rest/services -> 404) or GeoServer (/geoserver -> 404) was found anonymously. PMRDA's Line 3 page (https://www.pmrda.gov.in/en/pune-metro-line-3/maan-hinjawadi-shivajinagar-metro-line/) states the elevated line is 23.203 km with 23 stations but publishes no station list, alignment map or KML.
- Helps: Possible official Line 3 alignment and TOD-zone layers if the viewer is reachable after login or from a browser session; treat as view-only until PMRDA publishes services.
- Seen: Press note lists layers: PMRDA jurisdiction boundary, approved Regional Plans, proposed TP Schemes, village limits, municipal boundaries, MSRDC/PMRDA ring roads, Pune Metro corridors, railway network, PWD roads, TOD zones around metro stations; red/blue floodlines, sanctuaries, defence buffers being onboarded in phases.
- Verifier notes: Fetched https://gis.pmrda.gov.in/ : only Home/About/Contact/Validate Document/Login, a Geo Portal disclaimer, no map viewer, layer list, download links or service endpoints. /Account/Login is a username+password form with a public 'Register' link (no guest access). /Map, /geoserver/web/ return 404. Fetched and read the 6 Aug 2026 press-note PDF (355 KB): confirms a public GIS portal with Pune-region layers (metro corridors, ring roads, TOD zones, village/municipal boundaries, floodlines) but says nothing about downloads; disclaimer says public-information only, no data licence. Line 3 page links to the geoportal but publishes no station list, alignment map or KML. Claim is accurate: Pune planning data exists behind registration/login, view-only, no plain-GET file. Web search budget was exhausted so no further probing of endpoints via search.

## Unverified (verifier did not run)

### Geofabrik India / Western Zone OSM extract (.osm.pbf)
- Domain: `basemap-roads` · usefulness: **core** · format: pbf · access: direct_download
- Page: <https://download.geofabrik.de/asia/india/western-zone.html>
- File: <https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf>
- Licence: ODbL 1.0 (OpenStreetMap contributors)
- What: Full OSM data for India's Western Zone (Maharashtra, Gujarat, Goa, Dadra & Nagar Haveli, Daman & Diu). Confirmed via western-zone.poly: polygon spans lon ~67.7–80.9, lat ~14.4–24.7 and contains Pune (73.85, 18.52). Daily rebuilds; latest contains OSM data up to 2026-10-17T20:20Z. There is NO Maharashtra-only or Pune-only extract on Geofabrik; western-zone is the smallest region containing Pune. Also has dated snapshots (e.g. western-zone-261017.osm.pbf).
- Helps: Source file for OSRM (osrm-extract/-contract) and for osm2pgsql/osmium import into PostGIS: roads, buildings, POIs, localities. Clip to the Pune bbox with osmium extract -b 73.70,18.40,74.00,18.70 before processing.

### BBBike extract service (custom OSM bbox cut, many formats)
- Domain: `basemap-roads` · usefulness: **core** · format: pbf · access: portal_page
- Page: <https://extract.bbbike.org/>
- Licence: ODbL 1.0 (OpenStreetMap contributors); service is free
- What: Free on-demand extractor: draw a box/polygon (Pune bbox fits comfortably), choose format (PBF, OSM XML, GeoPackage, Shapefile, GeoJSON, GeoParquet, CSV, SQLite, MBTiles/PMTiles Shortbread vector tiles, Garmin, OsmAnd, Mapsforge, SRTM elevation). No login; enter an email and the download link is sent when the job finishes (served from download2.bbbike.org). Area limit enforced as 'Area too large, please zoom in' for very large boxes; a 30x30 km box is fine.
- Helps: Fastest way to get a Pune-only PBF (~20-40 MB) for OSRM plus a ready-made Shortbread PMTiles/MBTiles basemap of just Pune for MapLibre, without downloading the 211 MB zone file.

### OpenFreeMap public vector tiles + styles (no API key)
- Domain: `basemap-roads` · usefulness: **core** · format: api · access: api
- Page: <https://openfreemap.org/quick_start/>
- File: <https://tiles.openfreemap.org/styles/liberty>
- Licence: MIT (project); data ODbL OpenStreetMap; attribution 'OpenFreeMap © OpenMapTiles, Data from OpenStreetMap' required
- What: Free hosted OpenMapTiles-schema vector tiles with ready MapLibre styles: https://tiles.openfreemap.org/styles/liberty, .../styles/bright, .../styles/positron (plus dark, fiord, 3d). No registration, no API key, no limits on map views/requests; offline bulk download capped at 3,000 tiles / 50 MB, max 4 parallel requests, unique User-Agent required. Weekly planet updates. Self-host option: weekly planet files at https://btrfs.openfreemap.com/areas/planet/{version}/tiles.btrfs|.mbtiles|.pmtiles (index at https://btrfs.openfreemap.com/files.txt, ~90 GB).
- Helps: Drop-in basemap for MapLibre: new maplibregl.Map({style:'https://tiles.openfreemap.org/styles/liberty'}). Zero setup for the Google-Maps-style UI.

### Pune City Subdistrict and Haveli Subdistrict — OSM relations 10351626 / 10351627 (admin_level 6)
- Domain: `basemap-roads` · usefulness: **core** · format: geojson · access: api
- Page: <https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A60%5D%3Brelation%5B%22boundary%22%3D%22administrative%22%5D%5B%22name%22~%22Pune%7CPimpri%7CHaveli%22%5D%2818.3%2C73.5%2C18.9%2C74.2%29%3Bout%20tags%3B>
- File: <https://polygons.openstreetmap.fr/get_geojson.py?id=10351626&params=0>
- Licence: ODbL 1.0
- What: Overpass query confirmed: relation 10351626 'Pune City Subdistrict' (admin_level 6, wikidata Q7260101) roughly equals the Pune Municipal Corporation core city; relation 10351627 'Haveli Subdistrict' (admin_level 6, Q3309810) surrounds it and contains Pimpri-Chinchwad. Polygons downloadable via https://polygons.openstreetmap.fr/get_geojson.py?id=10351626&params=0 and id=10351627, or Nominatim lookup R10351626,R10351627.
- Helps: Best available OSM proxy for PMC (Pune City taluka) vs PCMC/outskirts (Haveli) when splitting the city into comparison areas.

### Geofabrik Western Zone free Shapefile bundle (shp.zip)
- Domain: `basemap-roads` · usefulness: **useful** · format: shapefile · access: direct_download
- Page: <https://download.geofabrik.de/asia/india/western-zone.html>
- File: <https://download.geofabrik.de/asia/india/western-zone-latest-free.shp.zip>
- Licence: ODbL 1.0 (OpenStreetMap contributors)
- What: Same Western Zone extract delivered as the free Geofabrik shapefile layer set (roads, railways, waterways, buildings, landuse, natural, places, POIs, transport, traffic, water as separate layers; WGS84). Dated 2026-10-18. Load directly with shp2pgsql/ogr2ogr; clip with -clipsrc to the Pune bbox.
- Helps: Quick PostGIS import of roads/places/POI layers without running osm2pgsql; good for area-comparison and nearest-facility queries.

### VersaTiles public tiles, styles and planet download (Shortbread schema)
- Domain: `basemap-roads` · usefulness: **useful** · format: other · access: api
- Page: <https://docs.versatiles.org/guides/download_tiles.html>
- File: <https://tiles.versatiles.org/assets/styles/colorful/style.json>
- Licence: Data ODbL (OSM contributors) + CC BY 4.0 (ESA WorldCover); stack FLOSS
- What: Free hosted Shortbread vector tiles at https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y} (TileJSON: https://tiles.versatiles.org/tiles/osm/tiles.json, z0–14, 26 layers incl. streets, street_labels, buildings, pois, public_transport, boundaries, place_labels). MapLibre styles: https://tiles.versatiles.org/assets/styles/colorful/style.json (also natural, muted, gray, toner; glyphs and sprites hosted). No API key, no fees; limits not stated. Self-host a Pune subset with: versatiles convert --bbox "73.70,18.40,74.00,18.70" --bbox-border 3 https://download.versatiles.org/osm.versatiles pune.versatiles (full planet osm.versatiles is 62 GB; dated builds listed at download.versatiles.org).
- Helps: Second no-key basemap option for MapLibre, and the easiest way to build a small self-hosted Pune-only vector tile file for offline/local demo.

### Protomaps basemap builds (PMTiles) + hosted API
- Domain: `basemap-roads` · usefulness: **useful** · format: other · access: portal_page
- Page: <https://docs.protomaps.com/basemaps/downloads>
- Licence: ODbL Produced Work; OSM attribution required
- What: Daily planet basemap builds (v4 schema, ~120 GB, z0–15) listed at https://maps.protomaps.com/builds (JS page; mirror at source.coop/protomaps/openstreetmap). Extract Pune with the CLI: pmtiles extract <build-url>.pmtiles pune.pmtiles --bbox=73.70,18.40,74.00,18.70 --maxzoom=15 (a few tens of MB). Use in MapLibre via pmtiles:// protocol with the @protomaps/basemaps style package (https://unpkg.com/@protomaps/basemaps@5/dist/basemaps.js; glyphs https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf). Hosted API at https://protomaps.com/api requires a key but is free for non-commercial use.
- Helps: Single-file Pune basemap (pune.pmtiles) servable from any static host, no tile server needed; good for the student deployment.

### Overpass API mirrors faster/less loaded than overpass-api.de
- Domain: `basemap-roads` · usefulness: **useful** · format: api · access: api
- Page: <https://wiki.openstreetmap.org/wiki/Overpass_API>
- File: <https://lz4.overpass-api.de/api/interpreter>
- Licence: ODbL (OSM); FOSSGIS fair-use policy
- What: Public Overpass instances: main https://overpass-api.de/api/interpreter (also lz4.overpass-api.de and z.overpass-api.de; policy ~10,000 queries / 1 GB per day, rate limit 2 slots, send User-Agent); VK Maps https://maps.mail.ru/osm/tools/overpass/api/interpreter ('no request limitations'); Private.coffee https://overpass.private.coffee/api/interpreter (no rate limit, notify for bulk); NextGIS https://overpass.nextgis.com/<key>/api/interpreter (free key). During testing on 2026-10-19 overpass-api.de returned 502s, lz4.overpass-api.de and maps.mail.ru answered (mail.ru timed out on heavy relation queries).
- Helps: Fallback endpoints for the existing Overpass POI pipeline so re-fetches do not fail when the main server is overloaded.

### OSRM public demo server (worldwide, car/bike/foot)
- Domain: `basemap-roads` · usefulness: **useful** · format: api · access: api
- Page: <https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server>
- File: <https://routing.openstreetmap.de/routed-car/route/v1/driving/73.8567,18.5204;73.8077,18.5153>
- Licence: FOSSGIS usage terms (non-commercial, 1 req/s); data ODbL
- What: https://router.project-osrm.org and https://routing.openstreetmap.de (FOSSGIS). Confirmed working in Pune: /route/v1/driving/73.8567,18.5204;73.8077,18.5153 returns 7,583 m / 558 s on router.project-osrm.org; routing.openstreetmap.de/routed-foot (also routed-car, routed-bike) returns a 7,107 m walking route. Policy: max 1 request/second, non-commercial reasonable use only, valid User-Agent/Referer, no scraping, no uptime guarantee.
- Helps: Prototype commute-time and nearest-facility routing before the self-hosted OSRM container is ready; same /route, /table, /nearest API as self-hosted OSRM.

### Nominatim public geocoder (nominatim.openstreetmap.org) and usage policy
- Domain: `basemap-roads` · usefulness: **useful** · format: api · access: api
- Page: <https://operations.osmfoundation.org/policies/nominatim/>
- File: <https://nominatim.openstreetmap.org/search?q=Kothrud+Pune&format=json>
- Licence: ODbL (OSM); OSMF usage policy
- What: Search/reverse/lookup endpoints at https://nominatim.openstreetmap.org/{search,reverse,lookup}. Policy: absolute max 1 request/second per app, identifying User-Agent/Referer required, results must be cached, NO autocomplete, no systematic/grid queries, long-running scripts limited to 4 req/min; access can be withdrawn. Lookup with polygon_geojson=1 returns boundary polygons (e.g. https://nominatim.openstreetmap.org/lookup?osm_ids=R1986140,R10351626,R10351627,R15027480&format=geojson&polygon_geojson=1 verified).
- Helps: One-off geocoding of college/office addresses and PG listings into lat/lon at import time (not for live type-ahead).

### Photon geocoder (photon.komoot.io) — autocomplete-friendly
- Domain: `basemap-roads` · usefulness: **useful** · format: api · access: api
- Page: <https://photon.komoot.io/>
- File: <https://photon.komoot.io/api/?q=Kothrud+Pune&lat=18.52&lon=73.85&limit=5>
- Licence: ODbL (OSM data); Photon Apache-2.0; fair use
- What: Elasticsearch-based OSM geocoder with search-as-you-type support: https://photon.komoot.io/api/?q=...&lat=18.52&lon=73.85&limit=5&lang=en and https://photon.komoot.io/reverse?lat=..&lon=... Confirmed India coverage: q=Kothrud Pune returns Kothrud (landuse/residential 73.8057,18.5073) and Kothrud Depot bus station. Policy: free for projects, 'extensive usage will be throttled', no availability guarantee, terms may change.
- Helps: Search box autocomplete for localities/colleges in the MapLibre UI, which Nominatim's policy forbids.

### Pune District boundary — OSM relation 1986140 (admin_level 5)
- Domain: `basemap-roads` · usefulness: **useful** · format: geojson · access: api
- Page: <https://www.openstreetmap.org/api/0.6/relation/1986140>
- File: <https://polygons.openstreetmap.fr/get_geojson.py?id=1986140&params=0>
- Licence: ODbL 1.0
- What: boundary=administrative, admin_level=5, name=Pune, name:en=Pune District, ref:LGD:district=490, wikidata Q1797336; 36 outer ways + admin_centre node. Bbox 17.895–19.395 N, 73.323–75.164 E. GeoJSON via Nominatim lookup (R1986140, polygon_geojson=1) or https://polygons.openstreetmap.fr/get_geojson.py?id=1986140&params=0.
- Helps: Outer clip/mask for the study area and district-level context on the map.

### Pune Metropolitan Region (PMRDA) — OSM relation 15027480 (admin_level 7, boundary=local_authority)
- Domain: `basemap-roads` · usefulness: **useful** · format: geojson · access: direct_download
- Page: <https://www.openstreetmap.org/api/0.6/relation/15027480>
- File: <https://polygons.openstreetmap.fr/get_geojson.py?id=15027480&params=0>
- Licence: ODbL 1.0
- What: admin_level=7, boundary=local_authority, local_authority:IN=metropolitan_area, name=Pune Metropolitan Region, official_name=Pune Metropolitan Region Development Authority, population 8,231,000 (2022), wikidata Q7260110; 27 outer ways, 10 subarea relations, admin_centre node 16174445 (Pune). Verified GeoJSON MultiPolygon at https://polygons.openstreetmap.fr/get_geojson.py?id=15027480&params=0. Only admin_level 7/8 boundary relation found in the Pune bbox; it is the only OSM polygon that encloses both PMC and PCMC.
- Helps: Metropolitan-scale mask for the app's service area; subarea relations give the constituent talukas.

### Valhalla public demo (valhalla1.openstreetmap.de, FOSSGIS)
- Domain: `basemap-roads` · usefulness: **nice** · format: api · access: api
- Page: <https://valhalla.openstreetmap.de/>
- File: <https://valhalla1.openstreetmap.de/route?json={"locations":[{"lat":18.5204,"lon":73.8567},{"lat":18.5153,"lon":73.8077}],"costing":"auto"}>
- Licence: FOSSGIS usage terms (non-commercial, ~1 req/s); data ODbL
- What: Public Valhalla instance by FOSSGIS/OpenStreetMap.de. Confirmed working for Pune: /route with auto costing between Shivajinagar and Kothrud returns 8.44 km / 1772 s. Supports /route, /isochrone, /sources_to_targets (matrix), /locate with pedestrian, bicycle, auto, bus, motor_scooter costings. Same operator and fair-use terms as routing.openstreetmap.de (1 req/s, non-commercial, no SLA); terms page itself (fossgis.de) is behind bot protection.
- Helps: Isochrones (e.g. 15/30-min commute polygons to a college) and multimodal costings that OSRM lacks; useful for the area-comparison feature.

### OSM India boundary tagging conventions (admin_level reference)
- Domain: `basemap-roads` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://wiki.openstreetmap.org/wiki/India/Local_Government_Boundaries>
- Licence: CC BY-SA 2.0 (OSM wiki)
- What: India scheme: admin_level 4 = state, 5 = district (Zilla), 6 = subdistrict/taluka, 7 = metropolitan area, 8 = municipal corporation / municipality / nagar panchayat (with local_authority:IN=*), 9 = civic zone, 10 = ward (ward=<number>). Cantonment boards tagged local_authority:IN=*. Companion page: https://wiki.openstreetmap.org/wiki/India/Administrative_Boundaries.
- Helps: Tells you which admin_level to query/import and explains why PMC/PCMC (level 8) and wards (level 10) are absent for Pune in OSM.

### OSM standard raster tiles (tile.openstreetmap.org) usage policy
- Domain: `basemap-roads` · usefulness: **nice** · format: api · access: api
- Page: <https://operations.osmfoundation.org/policies/tiles/>
- File: <https://tile.openstreetmap.org/12/2889/1853.png>
- Licence: ODbL data; CC BY-SA tiles; OSMF tile usage policy
- What: https://tile.openstreetmap.org/{z}/{x}/{y}.png may be used for normal interactive viewing with a distinct User-Agent and Referer and proper attribution; bulk download, prefetch/offline, and heavy app use are forbidden; no SLA. Useful only as an emergency raster fallback layer.
- Helps: Raster fallback basemap in MapLibre if the vector tile providers are down.

### HOT Export Tool (export.hotosm.org)
- Domain: `basemap-roads` · usefulness: **nice** · format: shapefile · access: portal_page
- Page: <https://github.com/hotosm/osm-export-tool>
- Licence: ODbL (data); BSD-3-Clause (tool)
- What: Web service to export customised OSM data for a drawn/uploaded polygon in GIS formats (Shapefile, GeoPackage, GeoJSON, CSV, KML, OSM PBF, MBTiles, Garmin, OsmAnd) with tag-based feature selection (e.g. only highways + amenities). Public instance at https://export.hotosm.org (JS single-page app; needs OSM account login to run an export). Code BSD-3; data ODbL.
- Helps: Alternative to BBBike extract when you want a tag-filtered Pune export (e.g. roads + hostels only) as GeoPackage for PostGIS.

### AICTE approved-institutes JSON feed (facilities.aicte-india.org dashboard back end)
- Domain: `education-employment` · usefulness: **core** · format: api · access: api
- Page: <https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php?method=fetchdata&year=2025-2026&program=1&level=1&institutiontype=1&Women=1&Minority=1&state=Maharashtra&course=1>
- File: <https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php?method=fetchdata&year=2025-2026&program=1&level=1&institutiontype=1&Women=1&Minority=1&state=Maharashtra&course=1>
- Licence: Government of India public dashboard data (no explicit licence stated; AICTE publishes it as self-disclosure data)
- What: Live JSON (array of 8-element arrays, no field names) of every AICTE-approved institute in Maharashtra for 2025-26: [AICTE permanent id, institute name, full postal address, district (e.g. PUNE), institution type (Private-Self Financing / Government / Deemed...), women-only Y/N, minority Y/N, second id]. Roughly 1,500 Maharashtra rows; about 250-300 with district=PUNE (manual tally of two of three 100k-char chunks gave 91 and 92 PUNE rows). Change the year param for other years. This is the data behind the public 'Approved Institutes' tab of the AICTE dashboard (angulardashboard.php#!/approved).
- Helps: Authoritative list of all technical colleges (engineering, pharmacy, management, architecture, polytechnic) in Pune district with street addresses -> geocode as commute destinations

### MahaCET CAP institute lists + institute summary pages (FE 2025 engineering, Pharmacy 2025, B.Design 2025)
- Domain: `education-employment` · usefulness: **core** · format: html_table · access: portal_page
- Page: <https://fe2025.mahacet.org/StaticPages/frmInstituteList>
- Licence: Government of Maharashtra public admission data (no explicit licence)
- What: State CET Cell (DTE Maharashtra) list of all 372 engineering institutes participating in 2025-26 CAP (code, name, status, intake; ph2025.mahacet.org has 531 pharmacy institutes, bdesigncap2025 has 10). Each 5-digit code links to StaticPages/frmInstituteSummary.aspx?InstituteCode=NNNNN which gives Institute Address, Region, District, status, autonomy, minority, and course/intake table (verified e.g. code 06122 -> 'S. V. No. 33/22, Bavdhan(Khurd), Tal-Mulashi ... Dist. Pune'). Pune-region codes are 06xxx. Same pattern expected on me2025/mba2025/poly portals (mba2025 host did not resolve at check time).
- Helps: Official DTE/CET institute codes + addresses + intake for every engineering/pharmacy college in Pune region; complements AICTE feed and gives region/district fields for commute destinations

### MIDC Enterprise GIS - ArcGIS REST services (plot-level allottee data with lat/lon)
- Domain: `education-employment` · usefulness: **core** · format: api · access: api
- Page: <https://gis.midcindia.org/server/rest/services/CitizenPortal/MIDC_Statewide_Allottee_Map_Service/MapServer/0>
- File: <https://gis.midcindia.org/server/rest/services/CitizenPortal/MIDC_Statewide_Allottee_Map_Service/MapServer/0/query?where=Industrial_Area_Name%20LIKE%20%27%25Hinj%25%27&outFields=*&f=geojson>
- Licence: MIDC public GIS portal (gis.midcindia.org/MIDCGISPortal); no explicit licence text (copyrightText empty) - treat as public-sector reference data, attribute MIDC
- What: Public ArcGIS REST (no login) layer V_Plot_Mrsac_Info: 111,254 MIDC plot polygons statewide (EPSG:32643) with fields Industrial_Area_Name, RO_Name, GIS_Plot_No, Area_In_sqm, Plot_Type, Plot_Status, Allotee, Company_Name, Manufacturing_Activity, Lessee_Name, Longitude, Latitude etc. Query supports JSON/geoJSON, maxRecordCount 2000. Verified: 9,151 plots match Hinjewadi/Pimpri/Bhosari/Chakan/Talawade/Chinchwad; Hinjawadi Ph-I rows show allottees such as Dassault Systemes, Wipro Ltd, EFC Estate with coordinates. Sibling services: CitizenPortal/MIDC_PUBLIC_MAIN_MAP_SERVICE/MapServer (layers: MIDC Boundary, Plot Boundary, MIDC Office/Amenity, Taluka, District; table 22 V_Industrial_Information with IA_Name, District, Total_Plots, No_of_Alloted_Plots, No_Of_Vacant_Plots), CitizenPortal/SWC_GIS_AllMasterData_Alloted/MapServer, WMS/WMS_GIS_Master/MapServer. Root directory: https://gis.midcindia.org/server/rest/services
- Helps: Plot-by-plot employer/company names and polygons for Rajiv Gandhi Infotech Park Hinjawadi Ph I-III, Pimpri, Chinchwad, Bhosari, Talawade, Chakan Ph1-5, Ranjangaon -> workplace destinations and industrial-area boundaries for the map

### SEZ India - List of States/UTs-wise Operational SEZs (upto 31.03.2026)
- Domain: `education-employment` · usefulness: **core** · format: pdf · access: direct_download
- Page: <https://sezindia.gov.in/operational-sez>
- File: <https://sezindia.gov.in/sites/default/files/operational_SEZ/Operational%20SEZs%20in%20India%20277.pdf>
- Licence: Government of India (GIGW / open publication)
- What: 24-page PDF (Excel export) from Dept of Commerce: Sl No, state-wise Sl No, Developer, Location, Type of SEZ, Remarks. Maharashtra section (pp.10-13) includes ~20 Pune-district operational SEZs with locations: Serum Bio-pharma Park (Hadapsar/Manjri), EON Kharadi Infrastructure (Kharadi, Haveli, 2 entries), Wipro (Hinjawadi), Syntel (Talwade Software Park), Manjri Stud Farm/SP Infocity (Phursungi), Infosys (RGIP Ph-II, Mann), MIDC RGIP Hinjawadi Ph-III, Magarpatta Township (Hadapsar), Quadron Business Parks (Plot 28 RGIP Ph-II), Qubix/Blue Ridge (Hinjawadi), Embassy Pune TechZone (Plot 3 RGIP Ph-II Marunji), Khed Economic Infrastructure (Khed), and more. Older snapshots (2022-2025) also on the page. Companion 'List of Notified SEZs as on 31.07.2026' (37 pp) at https://sezindia.gov.in/sites/default/files/notifed/Notified%20SEZs%207%2B10%2B353.pdf has the same Pune entries plus notified-but-not-operational ones.
- Helps: Authoritative list of Pune IT/ITES SEZ campuses (Magarpatta, EON Kharadi, Hinjewadi SEZs, Blue Ridge, Talawade, Phursungi) with village/taluka locations to geocode as major employment hubs

### AISHE Higher Education Institution Directory (dashboard.aishe.gov.in)
- Domain: `education-employment` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://dashboard.aishe.gov.in/hedirectory/#/hedirectory/universityDetails/C/ALL>
- Licence: Government of India / NIC (public)
- What: Ministry of Education directory of 54,422 colleges (plus universities at .../U/ALL and standalone institutions at .../S/ALL) filterable by State, District (Pune), College Type, University; columns: AISHE Code, Name (often with locality in name), State, District, Web URL, Year of Establishment, Location (Urban/Rural), College Type, Management, Affiliated University Name/Type. Page has a download icon for export. No street address or coordinates. Opened in the in-app browser (WebFetch fails on TLS cert).
- Helps: Complete master list of all Pune-district colleges (arts/science/commerce, law, education etc., not only AICTE ones) with AISHE codes and affiliating university -> join with address sources below

### AIKosh - All Colleges as per AISHE Dashboard (XLSX)
- Domain: `education-employment` · usefulness: **useful** · format: xlsx · access: portal_page
- Page: <https://aikosh.indiaai.gov.in/home/datasets/details/all_colleges_as_per_aishe_dashboard_3.html>
- Licence: Open Government Data Licence - India (OGL India)
- What: 4.35 MB XLSX 'All Colleges AISHE Dashboard.xlsx' published by Dept of Higher Education on AIKosh (uploaded Dec 2025): AISHE Code, Institution Name, State, District, Year of Establishment, Location, College Type, Management, Affiliated University Name/Type. Visibility 'Open'; download button may require a free AIKosh login. Companion dataset 'All Universities as per AISHE Dashboard'.
- Helps: Bulk offline copy of the AISHE directory (filter District=Pune) with an explicit open licence

### zed-inn/indian-institute-dataset (cleaned AISHE directory, GitHub)
- Domain: `education-employment` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://github.com/zed-inn/indian-institute-dataset>
- File: <https://raw.githubusercontent.com/zed-inn/indian-institute-dataset/main/output/indian-institutes.csv>
- Licence: Not stated in repo; derived from AISHE (Govt of India) data
- What: 70,016 Indian HE institutes cleaned from AISHE (2024): pipe-delimited output/indian-institutes.csv with aishe_code, name, name_untouched, state, district, website, year_of_establishment, location, category, college_type, management, university_name, university_type, administrative_ministry, standalone_type, pin_code, email, phone_number, institute_code. No coordinates; pin_code helps geocoding. Raw file >10 MB (WebFetch could not stream it; clone the repo). No licence file stated - underlying data is government AISHE data.
- Helps: Ready-made CSV with PIN codes and website/phone for every Pune college; good for geocoding fallback and enrichment

### PriyanKishoreMS/colleges-api - colleges.csv (AISHE survey with street addresses)
- Domain: `education-employment` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://raw.githubusercontent.com/PriyanKishoreMS/colleges-api/master/data/colleges.csv>
- File: <https://raw.githubusercontent.com/PriyanKishoreMS/colleges-api/master/data/colleges.csv>
- Licence: Not stated; data sourced from data.gov.in (AISHE)
- What: ~43,000 Indian colleges from data.gov.in AISHE survey; CSV header: id,state,name,address_line1,address_line2,city,district,pin_code. Verified Pune rows with full addresses (e.g. 'S.NO. 3/1+4, Tathawade, Dange Chowk Aundh Rawet Road, Pune-411 033'). ~6 MB; repo unmaintained, snapshot circa 2022; no LICENSE file (data is government-sourced).
- Helps: The only bulk CSV found that carries street addresses for non-technical colleges in Pune -> geocode arts/science/commerce/law colleges

### SPPU (Savitribai Phule Pune University) BoD College & Course Search
- Domain: `education-employment` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://bcud.unipune.ac.in/utilities/college_search/NewSearchCollege.aspx>
- Licence: University public data (no explicit licence)
- What: Official SPPU search of affiliated colleges by faculty, district (Pune/Nashik/Ahilyanagar), taluka and name; each result page (pattern bcud.unipune.ac.in/utilities/college_search/<UnipuneID>_ENG/Pune_University_College, e.g. CAAP022230) shows Unipune ID, college name, postal address with taluka/district/PIN, affiliation year and approved courses. SPPU snapshot page states 629 affiliated colleges, 185 recognised institutes. No bulk export (the old PDF 'List_of_Affiliated_colleges.pdf' and the affiliated_colleges_and_institutions page are 404/DNS-dead).
- Helps: Authoritative SPPU affiliation status + address for Pune-district colleges; scrape search results per taluka or use to verify AISHE/AICTE lists

### DTE Maharashtra - list of institutes for bio-authentication (region-wise, with addresses and AISHE codes)
- Domain: `education-employment` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://dte.maharashtra.gov.in/wp-content/uploads/2023/08/List-of-Inst-for-Bio_Authentication-to-RO-.pdf>
- File: <https://dte.maharashtra.gov.in/wp-content/uploads/2023/08/List-of-Inst-for-Bio_Authentication-to-RO-.pdf>
- Licence: Government of Maharashtra (public document)
- What: 23-page PDF (Aug 2023) from DTE Maharashtra: Sr No, State, District, Institution Name, Login Id/AISHE code, Address, principal/contact names and phone numbers, DTE Region (PUNE etc.). 84 Pune-district rows (e.g. Suryadatta, Bavdhan; D.Y. Patil, Pimpri; Sinhgad, Maval; Army Institute of Technology). Note: contains personal contact phone numbers - use only the institution/address columns.
- Helps: Cross-walk between DTE institutes, AISHE codes and addresses for Pune region technical colleges

### SEEPZ SEZ Pune Cluster - About page (list of SEZs under Pune cluster)
- Domain: `education-employment` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://seepz.gov.in/pune-cluster-about>
- Licence: Government of India (public)
- What: Office of the Development Commissioner SEEPZ-SEZ page naming the SEZs administered by the Pune cluster with addresses: Embassy Tech Zone (RGIP Hinjawadi Ph-2), Khed Economic Infrastructure Pvt Ltd (office Bund Garden Rd), Magarpatta Township (Hadapsar), Nalanda SEZ IT Park (RGIP Ph-1), Embassy Quadron Business Park (RGIP Ph-2), Qubix SEZ Blue Ridge (RGIP Ph-1), Wockhardt SEZ Shendra. Site states 23 operational SEZs with 300+ units in the Pune cluster. Approval Committee minutes for Pune-cluster SEZ units are published monthly as ZIP archives at https://seepz.gov.in/sezs-pune-cluster-minutes (unit names per SEZ). The 'pune-cluster-list-of-sezs' page itself is still 'Coming soon'.
- Helps: Confirms SEZ names/locations for Hinjewadi, Magarpatta, Blue Ridge; minutes ZIPs can yield tenant-company names per SEZ

### MPCB SRO-wise Industry Database (31/07/2014) - SRO Pune-II and SRO Pimpri-Chinchwad PDFs
- Domain: `education-employment` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://www.mpcb.gov.in/industrial-statistics/sro-industry-database>
- File: <https://www.mpcb.gov.in/sites/default/files/industrial-statistics/sro-industry/SROPune2__SROdatabase_31072014.pdf>
- Licence: Government of Maharashtra (public)
- What: Maharashtra Pollution Control Board lists of consented (CAC/CC-level) industries per sub-regional office: Pune-II (55 pp; MIDC Ranjangaon, Chakan, Hinjawadi, Talegaon + non-MIDC) at .../SROPune2__SROdatabase_31072014.pdf and Pimpri-Chinchwad (33 pp; MIDC Pimpri-Chinchwad, Bhosari, Talwade + non-MIDC, plus 103 construction projects and 11 hospitals >100 beds) at .../SRO_PimpariChinchwad_SROdatabase_31072014.pdf. Columns: Industry name, plot address, industry type, category (Red/Orange), consent validity, investment (Rs cr). E.g. Century Enka Plot 72-74 MIDC Bhosari, Forbes Marshall A-34/35 H-Block MIDC Pimpri, 3M India B-20 MIDC Ranjangaon. Dated 2014. Newer per-meeting CAC indexes (e.g. 'Index of 4th CAC Meeting of 2023-24.pdf') list recent large projects incl. Embassy Pune Techzone Hinjewadi, Pune BP Development Kharadi.
- Helps: Named large manufacturing employers with plot addresses in PCMC/Chakan/Ranjangaon/Talegaon MIDC estates -> geocode as workplace destinations (complements MIDC GIS allottee layer)

### Wikidata SPARQL - educational institutions and businesses with coordinates inside the Pune bbox
- Domain: `education-employment` · usefulness: **useful** · format: api · access: api
- Page: <https://query.wikidata.org/sparql?format=json&query=SELECT%20%3Fitem%20%3FitemLabel%20%3Fcoord%20%3FtypeLabel%20WHERE%20%7B%20SERVICE%20wikibase%3Abox%20%7B%20%3Fitem%20wdt%3AP625%20%3Fcoord%20.%20bd%3AserviceParam%20wikibase%3AcornerSouthWest%20%22Point(73.70%2018.40)%22%5E%5Egeo%3AwktLiteral%20.%20bd%3AserviceParam%20wikibase%3AcornerNorthEast%20%22Point(74.00%2018.70)%22%5E%5Egeo%3AwktLiteral%20.%20%7D%20%3Fitem%20wdt%3AP31%20%3Ftype%20.%20%3Ftype%20wdt%3AP279*%20wd%3AQ2385804%20.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D%20LIMIT%20500>
- File: <https://query.wikidata.org/sparql?format=json&query=SELECT%20DISTINCT%20%3Fitem%20%3FitemLabel%20%3Fcoord%20WHERE%20%7B%20SERVICE%20wikibase%3Abox%20%7B%20%3Fitem%20wdt%3AP625%20%3Fcoord%20.%20bd%3AserviceParam%20wikibase%3AcornerSouthWest%20%22Point(73.70%2018.40)%22%5E%5Egeo%3AwktLiteral%20.%20bd%3AserviceParam%20wikibase%3AcornerNorthEast%20%22Point(74.00%2018.70)%22%5E%5Egeo%3AwktLiteral%20.%20%7D%20%3Fitem%20wdt%3AP31%2Fwdt%3AP279*%20wd%3AQ2385804%20.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D>
- Licence: CC0 1.0 (Wikidata)
- What: Verified SPARQL box query: 154 distinct educational institutions (subclass of Q2385804) with P625 coordinates in bbox 73.70,18.40-74.00,18.70 (e.g. Fergusson College 73.8392,18.5240; Modern College; College of Agriculture Pune; Balaji Law College). Same box with roots business/technology park/industrial park/business park (Q4830453, Q1497375, Q15077183, Q7540, Q5341295) returns 397 items (companies/parks). Results need DISTINCT (duplicate rows per type). Output JSON/CSV directly from the endpoint.
- Helps: Already-geocoded points (CC0) for ~150 Pune colleges/universities and ~400 companies/parks -> seed layer and validation set for geocoding the address lists

### UGC - List of 1788 approved Autonomous Colleges as on 28.02.2026
- Domain: `education-employment` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://www.ugc.gov.in/pdfnews/8688705_List-of-Autonomous-Colleges.pdf>
- File: <https://www.ugc.gov.in/pdfnews/8688705_List-of-Autonomous-Colleges.pdf>
- Licence: UGC / Government of India public document
- What: 78-page PDF grouped by state and affiliating university (section 'AFFILIATING UNIVERSITY: SAVITRIBAI PHULE PUNE UNIVERSITY' at p.36-38): college name with locality and PIN (e.g. Fergusson College Pune-411004, Cummins College Karvenagar-411052, IIIT Hinjawadi-411057, JSPM Hadapsar-411028), autonomy start year and validity period. ~60 Pune entries.
- Helps: Flags prestige/autonomous colleges (popular commute destinations) and gives locality+PIN for geocoding

### NIRF India Rankings 2025 - Engineering (and other category) ranking tables
- Domain: `education-employment` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://www.nirfindia.org/Rankings/2025/EngineeringRanking.html>
- Licence: Ministry of Education, Govt of India (public)
- What: Official HTML table (Institute ID, Name, City, State, Score, Rank) for ranks 1-100, with rank-band pages 101-150, 151-200, 201-300 (EngineeringRanking150.html, ...300.html). Pune entries include Symbiosis International (46) etc. Same URL pattern for OverallRanking, UniversityRanking, CollegeRanking, ManagementRanking, PharmacyRanking. Each institute has a 'More Details' link to its submitted data PDF under /nirfpdfcdn/2025/pdf/<Category>/<InstituteID>.pdf. Blocks WebFetch (403) but opens normally in a browser.
- Helps: Rank/score attribute for the college layer and a short list of the most-searched-for Pune institutes (COEP, Symbiosis, Bharati Vidyapeeth, SPPU, IISER, etc.)

### data.gov.in - Registrars of Companies (RoC)-wise Company Master Data (MCA)
- Domain: `education-employment` · usefulness: **nice** · format: csv · access: portal_page
- Page: <https://www.data.gov.in/resource/registrars-companies-roc-wise-company-master-data>
- Licence: NDSAP / Open Government Data Licence - India
- What: MCA company master data, selectable by Company State Code (maharashtra) with Preview & Download and an API tab; updated 13/10/2026, data up to 3 Nov 2023, monthly granularity. Catalog fields: CIN, date of registration, company name, status, class, category, authorised/paid-up capital, registered state, RoC (RoC-Pune), principal business activity, registered office address. Free data.gov.in API key needed for API; download needs free login. Large (Maharashtra file is hundreds of MB). Opened via in-app browser (WebFetch gets 403).
- Helps: Registered office addresses for every company under RoC Pune -> filter large/active companies by capital to build a 'major employers' layer; heavy to geocode, so use selectively

### MIDC Land Bank - all records by Regional Office / District / Industrial Area
- Domain: `education-employment` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://land.midcindia.org/LandBank/IndexforAllRecords>
- Licence: MIDC public portal (no explicit licence)
- What: MIDC Online Land Allotment System land-bank table filterable by Regional Office (RO PUNE-I, RO PUNE-II, RO PUNE-II (IT)), District (Pune), sector (I.T, I.T.E.S, Automobile...) and Industrial Area (Chakan Ph-1..5, Pimpri, Bhosari, Talawade, Hinjawadi phases, Ranjangaon, Addl. Jejuri, Kurkumbh, Baramati...). Very large page (>10 MB) listing plots with area and status. Opened in in-app browser.
- Helps: Authoritative names of all MIDC industrial areas in Pune district (for labelling employment zones); plot-level detail is better taken from the GIS REST service above

### Wikipedia - Hinjawadi (Rajiv Gandhi Infotech Park company lists by phase)
- Domain: `education-employment` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://en.wikipedia.org/wiki/Hinjawadi>
- Licence: CC BY-SA 4.0
- What: Article tables 'Major Companies in Phase-1/2/3' naming ~50 tenants (Phase 1: Accenture, Cognizant, Dassault, HCLTech, KPMG, LTIMindtree, Tata Technologies...; Phase 2: Infosys, Wipro, IBM, Emerson, Honeywell, VW ITS...; Phase 3: TCS, Tech Mahindra, Capgemini, KPIT, Synechron). Companion article https://en.wikipedia.org/wiki/Magarpatta lists ~40 companies by Cybercity tower (Accenture, Amdocs, Capgemini, HCL, John Deere, Deutsche Bank, Mphasis, SAS, WNS...). Undated, community-maintained.
- Helps: Human-readable employer names per IT park phase for labels/search synonyms ('TCS Hinjewadi Phase 3'); verify against MIDC GIS allottee data

### Wikipedia - List of educational institutions in Pune
- Domain: `education-employment` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://en.wikipedia.org/wiki/List_of_educational_institutions_in_Pune>
- Licence: CC BY-SA 4.0
- What: ~100-110 institutions grouped as Universities (state/deemed/private), Engineering & Technology, Management, Medical, Arts/Commerce/Science, Research institutes. Names only, few localities; needs citations.
- Helps: Curated short list of the well-known Pune institutions to prioritise/feature in search and to QA the bulk lists

### OpenCity - Pune Schools Data (PMC open data mirror)
- Domain: `education-employment` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-schools-data>
- File: <https://data.opencity.in/dataset/1aaa0768-c2ff-4b63-9f51-27af984743b8/resource/8b93f529-1dc2-4446-b198-9eaf83b94f58/download/905dfc93-7e5e-4821-b6ef-86b4f49f14b1.csv>
- Licence: Public Domain (as stated on OpenCity; source PMC open data)
- What: Six CSVs mirrored from opendata.punecorporation.org (public domain, updated Nov 2025): PMC schools list, list of all schools in PMC area (public/private/aided), class-wise enrolment, facilities, school-age population, and 'Total number of schools and colleges' (aggregate counts only, no college list). Direct CSV links on the page (e.g. list of schools: https://data.opencity.in/dataset/1aaa0768-c2ff-4b63-9f51-27af984743b8/resource/8b93f529-1dc2-4446-b198-9eaf83b94f58/download/905dfc93-7e5e-4821-b6ef-86b4f49f14b1.csv).
- Helps: School lists (not colleges) - optional 'schools nearby' amenity or for families; no college list here

### data.gov.in - PMRDA catalog (villages list + taluka-wise PMRDA boundary GIS)
- Domain: `education-employment` · usefulness: **nice** · format: other · access: portal_page
- Page: <https://www.data.gov.in/catalog/pune-metropolitan-region-development-authority>
- Licence: NDSAP / OGL India
- What: Three resources published Dec 2025/Jan 2026 under NDSAP: 'Villages under PMRDA as on 08 Jan 2026' (44 KB), 'Taluka-wise PMRDA Administrative Boundaries GIS Dataset as on 30 June 2025' (1.1 MB GIS), and anonymised PMRDA housing lottery 2024 tenements. Download needs free data.gov.in login.
- Helps: Not education/employment per se, but official PMRDA boundary and village list useful for area comparison outside PMC/PCMC limits (Hinjewadi, Wagholi are PMRDA villages)

### OpenCity – PMC Wards Info (electoral/admin ward + prabhag + zone polygons, KML)
- Domain: `pmc-open-data` · usefulness: **core** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-wards-info>
- File: <https://data.opencity.in/dataset/98f28dac-9158-46ee-a91e-a514d9af427c/resource/db368dd7-03ab-458f-a17d-ac87e04f11fb/download/24b7649d-0039-4dee-872a-621fa2b129d2.kml>
- Licence: Other (Public Domain) per OpenCity; source pmc.gov.in
- What: Seven KML polygon layers mirrored from pmc.gov.in, last updated 2025-11-27: (1) Electoral Wards 2022 – 58 polygons, fields wardnum, Name1 ('01 Dhanori - Vishrantwadi'), Name2, origin (links to now-dead pmc.gov.in ward-map PDFs); (2) PMC Electoral Wards 2025 – 41 polygons for the Jan-2026 election, only an integer field 'qwr', no names; (3) Electoral Wards 2017 – 41 polygons, fields ward, name-mr; (4) Electoral Wards 2012 – 76 polygons; (5) Administrative Wards 2017 – 15 polygons with names ('Admin Ward 01 Aundh'); (6) PMC Prabhag Boundary (year unknown) – 72 polygons with prabhag, prabhag_id, ward, ward_id, zone_id, Shape_Area; (7) PMZ Zones Map – 5 zone polygons (zone, Zone_Name). Dissolving the 2022 electoral layer (or the zones layer) gives the PMC municipal limit, which is not published as a standalone polygon. All WGS84.
- Helps: Ward/prabhag polygons for area comparison, ward-level joins (streetlights, hospitals, property tax, census), PMC limits mask. Other files: 2025 wards …/2badcc86-489c-4b7e-b7dd-a273ef01b798/download/b7a3f392-238c-4c55-a3ed-0c13fd4aaa0a.kml ; admin 2017 …/686cd9cd-012f-4f97-913f-8c7003b3eb02/download/b26b0ee3-60a3-4f1a-a45c-94b24fb9434a.kml ; prabhag boundary …/6e44317a-2838-4f5a-85dc-43ed80a490a6/download/a97cdf95-402a-461b-8bd6-3eb55103ee91.kml ; zones …/d02848cd-47ff-419d-bf21-3f20a98af766/download/882111ee-f944-4bff-b796-7baf97cf55a6.kml ; 2017 …/cc381e1b-7e2b-4022-9448-0a53d230b0f9/download/b408de88-b9f0-48ad-af37-d6554088fb8d.kml ; 2012 …/bfd393d4-5496-4f88-84b3-d794bf661ec0/download/06209242-c2c6-40f7-b70c-db0783cb7ccd.kml (all under https://data.opencity.in/dataset/98f28dac-9158-46ee-a91e-a514d9af427c/resource/)

### DataMeet Municipal_Spatial_Data – Pune ward GeoJSONs (2012/2017/2022 electoral, 2017 admin)
- Domain: `pmc-open-data` · usefulness: **core** · format: geojson · access: direct_download
- Page: <https://github.com/datameet/Municipal_Spatial_Data/tree/master/Pune>
- File: <https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Pune/pune-electoral-wards_2022.geojson>
- Licence: CC BY-SA 2.5 IN (per Pune Readme; project page says CC BY 4.0); 2022 file mirror MIT
- What: Ready-made GeoJSON (EPSG:4326) of PMC wards: pune-electoral-wards_2022.geojson (256 KB, 58 wards, traced from PMC's 2022 final delimitation PDFs, digitised by SeerMaps for Nikhil VJ), pune-electoral-wards_2017.geojson (101 KB, 41 wards), pune-electoral-wards_2012.geojson (368 KB, 76 wards, scraped from the SEC/PMC election site), pune-admin-wards_2017.geojson (297 KB, 15 admin wards). Readme warns boundaries are traced/scraped and imperfect. Does NOT include the 2025 (41-ward) delimitation.
- Helps: Drop-in PostGIS ward layer (no KML conversion needed) for area comparison and ward joins. Other raw URLs: …/Pune/pune-electoral-wards_2017.geojson, …/pune-electoral-wards_2012.geojson, …/pune-admin-wards_2017.geojson

### PMC Open Data Portal (new URL opendata.pmc.gov.in, live Sept–Dec 2025; JSON API at opendataapi.pmc.gov.in)
- Domain: `pmc-open-data` · usefulness: **core** · format: csv · access: api
- Page: <https://opendata.pmc.gov.in/datasets>
- File: <https://opendata.pmc.gov.in/opendata/c5380f98-6bec-43c7-850a-f1a22a386032.csv>
- Licence: PMC Open Data Policy endorsing NDSAP (National Data Sharing and Accessibility Policy); OpenCity mirrors label the same data 'Public Domain'; exact licence clause not rendered on the policy page
- What: The official PMC portal, relaunched in 2025 as a Next.js app with 238 datasets (count endpoint https://opendataapi.pmc.gov.in/datasets/dataset/count). Full catalogue JSON: https://opendataapi.pmc.gov.in/datasets?page=0&size=300 ; file index: https://opendataapi.pmc.gov.in/dataset-files?page=0&size=500 (324 files; each 'newFileName' is served at https://opendata.pmc.gov.in/opendata/<newFileName>); departments: /department ; categories: /category-master ; reports: /reports. The /opendata/ path is an open directory index with 415 files (204 xlsx, 95 pdf, 53 odt, 26 csv, 22 json). Geospatial/POI datasets confirmed: 'List of All Electoral Wards (Prabhags) with Geographic Coordinates' (CSV 8.8 KB, ~160 rows, prabhag centroid lat/long + Prabhag Name + Ward Name; 2017-era prabhags, some lake rows appended) ; 'Details of Facilities with Latitude and Longitude' (CSV 23 KB, ~430 rows: 57 traffic signals, 29 swimming pools, 22 octroi points, mandais, auditoriums, water works, entertainment centres, sight-seeing spots, CCTV cameras; column Location(lat,long)) ; 'List of Samaj Mandirs' (CSV 44 KB with lat/long) ; 'Location of Toilets' (Toilets.xlsx 65 KB, Dec 2025) ; 'Garden List in Pune' (xlsx 37 KB, Aug 2025) ; 'BRT & Non BRT Route Details & Bus Stop LatLong' (xls 6.8 MB) ; 'PMC Ward Offices' (xlsx) ; 'List of Libraries' (xlsx) ; 'Parking Lots 4-Dec-2023' (xls) and 'On-Street Parking' (xlsx) ; 'E-Waste Disposal Locations'. Tabular: Pune City Primary/Secondary School Data 2021-22 to 2024-25 (xlsx, ~230 KB each) ; List of Hospital / Maternity Home / School Buildings (PDF) ; Property Tax Billing and Collection Wardwise FY13-14 … FY24-25 (xlsx) ; Wardwise Per-Capita Water Supply (CSV: 15 wards, LPCD and hours of supply) ; Pune Water Treatment Plants (CSV with areas served) ; Length of Roads / Paved Roads & Usable Footpaths / Footpath Details / Cycle Tracks / Condition of Roads (prabhag-wise xlsx/csv) ; Map of Pune – 76 Wards (Final) PDF (2012 wards) ; Regional Disaster Management Plan – Pune City 2014-15 (PDF, not opened). Columns of the xlsx files were not inspected (only CSV/JSON peeked).
- Helps: Official POIs with coordinates (toilets, gardens, samaj mandirs, traffic signals, pools, ward offices, libraries, parking) for the nearest-amenity feature; prabhag centroids for labelling; ward-wise property tax, water supply hours and school lists for area comparison. Other direct files: facilities CSV …/opendata/bf35fb77-64db-424a-ab60-f972aa7f11e2.csv ; samaj mandir CSV …/6f715608-accc-44a2-8d54-1fd42bf9a13c.csv ; Toilets.xlsx …/82016e9f-3113-4a42-9489-be92665666b2.xlsx ; garden list …/ce7bf0d9-1eff-4e0b-9c2f-8f379168a0da.xlsx ; bus stop latlong xls …/e407e01b-af25-4871-83ea-2dc2791bcca6.xls ; ward offices …/3506123f-0fa2-494c-b13b-a4b7ec46617e.xlsx ; libraries …/196db7b1-a4f6-4959-9b16-6235ccd6021b.xlsx ; parking lots …/dce3fd7d-fddc-467c-bd3b-a98417e98e7e.xls ; on-street parking …/b3c38dae-0ad3-4179-a3ef-f4d4dc819561.xlsx ; hospital buildings PDF …/d61eb9e1-7119-49e8-bfb5-7e81ee789a70.pdf ; 76-ward map PDF …/4c1275b8-6b45-4512-932b-65e61022bb83.pdf ; property tax FY24-25 …/65b46b94-a35f-46a9-bdca-34dec70d9486.xlsx ; primary schools 2024-25 …/512182d6-3602-49db-aea8-abf9d5ae224b.xlsx ; per-capita water CSV …/6c2cc35f-b219-400b-8a4a-604194bea446.csv ; road length prabhag-wise …/17af5878-d4e8-4f0d-aa8b-a7fdc2510bc6.xlsx (all under https://opendata.pmc.gov.in/opendata/)

### DataMeet Pune_wards repo (PMC + PCMC electoral wards, admin ward offices, ward metadata CSV)
- Domain: `pmc-open-data` · usefulness: **useful** · format: geojson · access: direct_download
- Page: <https://github.com/datameet/Pune_wards>
- File: <https://raw.githubusercontent.com/datameet/Pune_wards/master/GeoData/pune-admin-wards.geojson>
- Licence: CC BY-SA 2.5 IN
- What: GeoData/pune-electoral-wards.geojson (368 KB, 2012-17 wards), pune-admin-wards.geojson (297 KB, 15 admin wards, scraped from Shelter Associates maps), pcmc-electoral-wards.geojson (168 KB, Pimpri-Chinchwad wards), CSVs/pune-admin-ward-offices.csv and pune-wards-info.csv (2012 voter counts, 2015-16 participatory budget). Single commit; older than the Municipal_Spatial_Data repo.
- Helps: Admin-ward polygons plus ward-office locations; PCMC wards if coverage extends to Pimpri-Chinchwad (west/north of the AOI).

### OpenCity – Pune Public Toilets (KML map + ward/zone CSVs)
- Domain: `pmc-open-data` · usefulness: **useful** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-public-toilets>
- File: <https://data.opencity.in/dataset/fe85ec2b-e02a-4281-8d14-4af20b911f24/resource/98a32ad9-b757-48f1-96c7-0dfd8e9e1551/download/f1d88eea-0aab-4d8c-8c23-2acc84c1bd6a.kml>
- Licence: Other (Public Domain)
- What: Pune Public Toilets Map KML: 547 Point placemarks, ExtendedData fields key, Facility_Name, latitude, longitude (e.g. 73.8749,18.5695). Plus 'Ward-wise Community and Public Toilets 2017' CSV and zone-wise counts CSV. Source opendata.punecorporation.org; created Jan 2024, updated 2025-11-27.
- Helps: Nearest public toilet layer; 547 official points (OSM coverage of toilets in Pune is sparse).

### OpenCity – Pune Healthcare: Hospitals and Clinics (ward-wise CSVs, government hospitals with lat/lon)
- Domain: `pmc-open-data` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-healthcare-hospitals-and-clinics>
- File: <https://data.opencity.in/dataset/f76361d3-d7f0-4d25-a62b-255053775f0b/resource/b7c847bc-2074-48fc-9197-09128ead3a58/download/6e3b9e85-8e0f-4c9f-8ae3-378b63b29aab.csv>
- Licence: Other (Public Domain)
- What: Five CSVs: Ward-wise Government Hospitals (50 rows; columns City Name, Ward No, Ward Name, Name of healthcare facility, Type of facility, Latitude, Longitude), Ward-wise Dispensaries, Ward-wise Private Clinics, Ward-wise Private Hospitals (all described as 'with locations'), and Ward-wise Hospitals with Capacity and Facilities (~737 rows incl. 663 private hospitals/nursing homes registered to Jan 2019; beds, doctors, ambulances; NO coordinates). Year not stated (c. 2017-19). Updated 2025-11-25.
- Helps: Official PMC hospital/maternity-home points with coordinates and bed capacity to enrich the OSM hospital layer; ward-wise counts for area comparison. Other files: dispensaries …/cccc71d4-f154-4279-bde5-12cee90cfc7d/download/6a9f1d50-db92-4cfa-9da4-e8b335bf7b63.csv ; private clinics …/20deed39-1a57-42d2-b39d-57656b589c55/download/edd85f6d-6b53-47ed-8221-8e2ca22c4eee.csv ; private hospitals …/04e33225-235d-47fb-ace9-0388640b772a/download/6a6d0a58-9d4e-442b-a473-9ce40c271cae.csv ; capacity …/7e4b6d1a-37f7-43a3-83d7-a63eaaa3aaf4/download/117354a8-7bea-4ebe-9aa4-560fcb877aa6.csv

### OpenCity – Pune Streetlights (ward-wise counts CSV)
- Domain: `pmc-open-data` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-streetlights>
- File: <https://data.opencity.in/dataset/c91fa694-5d22-4efd-a0b7-993a42c69966/resource/24458e14-2139-4348-ab4c-0df81dfb5bb0/download/a7f9edd5-8709-4022-bae6-8197274886e5.csv>
- Licence: Other (Public Domain)
- What: One CSV, 15 rows (one per admin ward): City Name, Zone Name, Ward Name, Number of Poles, No. of LED Bulbs, No. of poles with conventional/non-LED lights, Total length of roads (km), Number of street lights/poles per km of road, streets with adequate lighting (NA). Year not stated (c. 2017-19). No point coordinates. Created Feb 2024, updated 2025-11-25.
- Helps: Ward-level 'poles per km of road' is a direct input for the night-safety score, complementing the sparse OSM street-lamp points; join via the 15 admin-ward polygons.

### OpenCity – Pune PMPML Bus Stops and Routes (official stop KML, GTFS-style attributes)
- Domain: `pmc-open-data` · usefulness: **useful** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-bus-stops-and-routes>
- File: <https://data.opencity.in/dataset/30dd0c51-61d4-4085-99ab-9a8aec97b329/resource/2c43a9a6-9a58-48dd-8891-e5f3dbe9120c/download/46c96db4-af62-4b84-a479-5a0279a8f44a.kml>
- Licence: Other (Public Domain)
- What: Pune PMPML Bus Stops Map KML: 5,624 Point placemarks with GTFS stops.txt fields (stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, location_type, parent_station, wheelchair_boarding); 4.9 MB. Bus Depots KML (9 points: name, address, lat, long). PMPML Bus Routes List CSV (origin, destination, distance). Year not stated. Updated 2025-11-25.
- Helps: Official PMPML stop list with stop_ids (5.6k stops) for the nearest-bus-stop feature; more complete than OSM and joinable to any PMPML GTFS routes/trips. Depots: …/b5bad569-1c37-4dd7-9267-993a6edf8a1b/download/17f84424-1769-45a2-84d5-76f0089f7e3a.kml ; routes CSV …/433caa89-75e2-474d-b5d6-db8fd7a3171d/download/c91c0878-b4f9-419f-8d7c-97eb6c7a9083.csv

### OpenCity – Pune Parks and Gardens (polygon KML + gardens-with-locations CSV)
- Domain: `pmc-open-data` · usefulness: **useful** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-parks-and-gardens>
- File: <https://data.opencity.in/dataset/c6332bb9-b70c-4320-823f-4f454dbf676c/resource/101fe35c-5190-47c9-bf1d-7c0d806c47a1/download/bbbd1d45-23fd-442c-8b1d-6fc48a1064a0.kml>
- Licence: Other (Public Domain)
- What: Pune Parks and Gardens Map KML: 198 Polygon placemarks from the PMC property register (fields latitude, longitude, prabhag_no, ward_no, zone_no, peth_name, survey_no, area_sqmtr, owner_name, possession, status). 'Gardens with Locations' CSV: 81 gardens, columns Sr No, Facility Type, Name of Facility, Address, Location(lat,long) as one quoted '(18.5613,73.8953)' field, Prabhag Name, Ward Name. 'List of Parks and Gardens' CSV. Updated 2025-11-27.
- Helps: Garden polygons/points for a 'green space nearby' amenity score and area comparison. CSV: …/7a49e306-0e45-4330-9043-5e391fc62031/download/d8a3e772-2d5d-4e19-bbb0-fe04915c96aa.csv

### OpenCity – Pune Stormwater Drains, Nalla and River maps (KMZ/KML)
- Domain: `pmc-open-data` · usefulness: **useful** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-stormwater-drains>
- File: <https://data.opencity.in/dataset/a83b2053-2250-4e3c-9759-521c81679d24/resource/b9bdda98-a0d1-4e2e-aca3-36c6445751b5/download/3f7228b1-092e-4c66-a62f-6895cf33fbcd.kml>
- Licence: Other (Public Domain)
- What: PMC Stormwater Drains Map KMZ (22.2 MB), Pune Nalla Map KML (2.8 MB; 3,075 LineString placemarks, fields id, objectid, phase, st_length_), Pune River Map KML (main river waterbody), Pune SWD Utility Chambers KML and PMC SWD Chambers KML. Source PMC; created Nov 2025, updated 2025-12-08. No explicit flood-prone-spot layer.
- Helps: Nalla (stream) and river lines are the best open proxy for waterlogging/flood risk: buffer nallas and rivers to flag flood-prone PG locations. SWD KMZ: …/7b7bb529-d324-48c2-95eb-8eabbab4381b/download/4390b641-12ad-4438-bc6b-c938ea7ae5de.kmz ; river …/7507f222-3bcd-4881-b558-90c5cbc2625f/download/b0d9ef1f-14d7-4c93-a498-3ffb7c86737c.kml

### PMRDA public GIS portal (gis.pmrda.gov.in) and PMRDA maps page
- Domain: `pmc-open-data` · usefulness: **useful** · format: other · access: manual
- Page: <https://gis.pmrda.gov.in/>
- File: <https://www.pmrda.gov.in/wp-content/uploads/2026/07/RP_All_For_IT_Dept_New_PMR_Boundary1.png>
- Licence: Government of Maharashtra; viewing only, no reuse licence stated
- What: Launched 2026 (PMRDA press note, Aug 2026): public GIS with PMRDA jurisdiction boundary, approved Regional Plan, TP schemes, village limits, municipal (PMC/PCMC) boundaries, MSRDC/PMRDA ring roads, Pune Metro corridors, railways, PWD roads, TOD zones; Irrigation Dept red/blue floodlines, sanctuaries and defence buffers 'being onboarded in phases'. The landing page only offers /Account/Login (registration) and a Geo Portal disclaimer; no WMS/WFS or download found. PMRDA maps page (https://www.pmrda.gov.in/maps-2) exposes a Regional Plan map as a 7022×4968 PNG (https://www.pmrda.gov.in/wp-content/uploads/2026/07/RP_All_For_IT_Dept_New_PMR_Boundary1.png) and the villages page a PDF list (https://www.pmrda.gov.in/wp-content/uploads/2025/03/PreviewAllVillage.pdf, plus taluka PDFs).
- Helps: Only official place to view red/blue floodlines and municipal boundaries; could be georeferenced/traced manually for a flood-risk layer, but nothing is downloadable programmatically.

### OpenCity – Pune Schools Data (PMC schools and all schools in PMC area, CSV)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-schools-data>
- File: <https://data.opencity.in/dataset/1aaa0768-c2ff-4b63-9f51-27af984743b8/resource/8b93f529-1dc2-4446-b198-9eaf83b94f58/download/905dfc93-7e5e-4821-b6ef-86b4f49f14b1.csv>
- Licence: Other (Public Domain)
- What: Six CSVs: 'Pune - List of Schools In the PMC Area' (≥468 rows; columns Block name, Cluster name, Village Name, U-DISE Code, School Name, Management, Category, grades, teachers, Medium, phone, email; NO lat/lon or street address), 'Pune - PMC Schools', class-wise enrolment, facilities, 2017-18 enrolment, totals of schools and colleges. Updated 2025-11-25.
- Helps: School list with UDISE codes and village/locality names; geocode by school name + village or join to UDISE+ school directory for a nearest-school layer.

### OpenCity – Pune Fire Stations (KML points) and fire-call statistics
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-fire-stations>
- File: <https://data.opencity.in/dataset/49fd476d-ace4-4610-918c-cb09f4171cb2/resource/201f577f-a095-4313-b724-ae3ec3587fe7/download/d185bb0c-2307-4a7d-9106-11cd61570165.kml>
- Licence: Other (Public Domain)
- What: Pune Fire Stations Map KML: 14 Point placemarks with fields Name_of_Facility, Facility_Type_Category, Prabhag_Name, Ward_Name, Location_lat_, Long. Fire Call Statistics 2011-2020 CSV. Updated 2025-11-27.
- Helps: Emergency-services proximity input for the safety score.

### OpenCity – Pune Libraries (KML + CSV)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-libraries>
- File: <https://data.opencity.in/dataset/d6df18d8-7762-4dd7-9900-558bd12822ff/resource/7d15eb1e-8f4c-4b23-9553-9a45985d5000/download/3121d40a-a37e-4936-86ce-c1872bf9446c.kml>
- Licence: Other (Public Domain)
- What: Pune Libraries Map KML: 56 Point placemarks (fields name, address, class, latitude, longitude); Pune Libraries List CSV (public and private libraries). Date of data unknown. Updated 2025-11-25.
- Helps: Study-space amenity for a student-oriented nearest-POI list.

### OpenCity – Pune Microwatersheds Map (GeoJSON, SLUSI/GoI)
- Domain: `pmc-open-data` · usefulness: **nice** · format: geojson · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-microwatersheds-map>
- File: <https://data.opencity.in/dataset/6126853b-7995-470b-9b05-0c29dc03a481/resource/c80ccf3b-baab-4aa4-baae-be8587e10116/download/pune_micro_watersheds.geojson>
- Licence: Other (Public Domain) per OpenCity
- What: pune_micro_watersheds.geojson (13.4 MB): catchment, watershed and micro-watershed polygons covering Pune, sourced from slusi.da.gov.in (Soil & Land Use Survey of India). Uploaded 2026-01-20. Attributes not inspected.
- Helps: Drainage units for a hydrological flood-risk proxy (low-lying micro-watersheds along the Mula–Mutha).

### OpenCity – Pune Revenue Map (survey/GUT-number land parcels, KMZ)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-revenue-map>
- File: <https://data.opencity.in/dataset/b0d8b534-c6ce-450d-9ef1-2e13d415efaf/resource/447d4d6a-905e-4bf4-aae9-afda709a222f/download/a76a14a9-07ce-4a36-bba5-8f8c12351c6b.kmz>
- Licence: Other (Public Domain)
- What: PMC Revenue Map KMZ (3.9 MB): revenue (cadastral) map of the PMC area with survey numbers (GUT numbers). Source PMC; created 2025-11-04. The closest open thing to land-use/property-tax zoning geometry; peth/village-level parcels.
- Helps: Village/peth parcel boundaries to label localities and to join Maharashtra ready-reckoner (ASR) zones or property-tax zone tables if obtained later.

### OpenCity – Pune Road Centerline Map (KMZ)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-road-centerline-map>
- File: <https://data.opencity.in/dataset/9553e6b7-9570-4fec-8beb-53cf6dfcfdd7/resource/c8708513-5887-46bb-8a2a-0ec12cf7165a/download/9bb3235e-e9db-485d-b303-68ef8fd6bcd7.kmz>
- Licence: Other (Public Domain)
- What: Pune Road Centerline Map KMZ (3.9 MB), official PMC road centrelines. Created 2025-11-10.
- Helps: Cross-check OSM road network used by OSRM; compute road density per ward.

### OpenCity – Pune Sewage Network (KMZ) and Sewage Treatment Plants (KML)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-sewage-network>
- File: <https://data.opencity.in/dataset/87f26028-f7ea-4fa4-bc05-ced4463757dd/resource/28f536b9-d07d-4cc4-8a5a-68ab8df94876/download/pmc_sewage_pipeline.kmz>
- Licence: Other (Public Domain)
- What: PMC Sewage Pipeline Network KMZ (8.2 MB, Dec 2025). Separate dataset 'Pune Sewage Treatment Plants': KML with 20 STP polygons (STP_Name, STP_Capaci, Technology, Ward_Offic, Latitude, Longitude), proposed and existing.
- Helps: STP polygons as a negative amenity (odour) for area scoring. STP KML: https://data.opencity.in/dataset/eb12f642-e1bb-4475-840e-4c4746d98fe0/resource/8a81eb8d-de2b-4842-b3fd-c74cc44fdff4/download/9beb555b-b3b8-4f3b-947c-b33ba33615a5.kml

### OpenCity – Pune Crematoriums and Burial Grounds (KML polygons)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-crematoriums-and-burial-grounds>
- File: <https://data.opencity.in/dataset/e052723f-946f-4a84-a6c8-78cce5699c8c/resource/801abd42-ccdc-46cb-8e20-30aaf9f5582e/download/pmc_cremation_grounds.kml>
- Licence: Other (Public Domain)
- What: pmc_cremation_grounds.kml: 81 Polygon placemarks from the PMC property register with prabhag_no, ward_no, zone_no, peth_name, survey_no, latitude, longitude, structure, valuation. Created 2025-12-09.
- Helps: Optional negative amenity layer for area comparison.

### OpenCity – Pune Property Tax Collections (zone-wise and ward-wise CSVs)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-property-tax-collections>
- File: <https://data.opencity.in/dataset/18ce1d9a-54a4-49df-885a-07eea33680d0/resource/49759bdf-13d4-4854-818e-9fdb6679ef46/download/2bdd28ca-f5b5-4efc-83c9-5451f0fa82e7.csv>
- Licence: Other (Public Domain)
- What: Zone-wise property tax collection 2013-14 to 2020-21 (CSV) and ward-wise collection for FY2014-15 … 2018-19 (5 CSVs). Tabular only; no tax-zone polygons. Source opendata.punecorporation.org; updated 2025-11-25. (The PMC portal has the same series extended to FY2024-25 as xlsx.)
- Helps: Ward/zone property-tax demand and collection as an affluence proxy in area comparison; join to admin-ward polygons.

### OpenCity – Pune Census 2011 ward-wise data (+ 1981–2001 series)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-census-2011-data>
- File: <https://data.opencity.in/dataset/ed14d426-552a-43eb-adfa-dbfd3afbd068/resource/49f1fca6-6904-48de-ad4c-199108048658/download/aa1addf9-77d6-4990-b65c-20f0439fa1f5.csv>
- Licence: Other (Public Domain)
- What: Pune - Ward-wise Census Data 2011 (CSV, PMC wards; population, households, literacy etc.), Ward-wise Census Data With Names 2011 (PDF, Marathi), Pune Census 2011 at census-ward level (CSV). Related dataset pune-census-data-1981-2001. Publisher ORGI via PMC portal.
- Helps: Population density per ward for area comparison (join to the 2012 76-ward polygons, which match the 2011 census wards best).

### OpenCity – Pune Tree Census 2019 (per-tree points, 17 CSV parts)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-tree-census-2019>
- File: <https://data.opencity.in/dataset/f00d83b8-c70f-4fff-9ac7-9a6ab4255edf/resource/d1fc279c-7905-4fe0-9a55-9a797bd8710a/download/58e49c60-4e2b-4238-9a3e-173d4abccbca.csv>
- Licence: Other (Public Domain)
- What: ~4.0 million geotagged trees (Aug 2019 census) in 17 CSVs (16 × 250,000 rows + 9,000). Columns include geom (WKT POINT lon lat), northing (lat), easting (lon), ward, ward_name, girth_cm, height_m, canopy_dia_m, condition, botanical_name, common_name, road_name, ownership. Part 17 alone is 2.9 MB, so full set is roughly 1.3 GB.
- Helps: Aggregate to tree density / canopy per ward or hex for a 'green & shaded' livability score; too big to load raw into the app.

### OpenCity – Pune Slums Data (ward/prabhag counts, 2017 ward lists, PDF maps)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-slums-data>
- File: <https://data.opencity.in/dataset/410f4413-ffab-4637-802c-31f64f279d06/resource/4ed3e09f-8c19-4f58-9edd-68c50a80a49a/download/26eb7645-7ab7-4940-a8bb-e9ce0e76042e.csv>
- Licence: Other (Public Domain)
- What: 18 resources: ward-wise number of slums and population, ward-wise slums with declared status, prabhag-wise slum area, 10 ward-level 2017 slum lists (CSV, names only), and four PDF maps (Bhavani Peth, Bibwewadi, Kasba-Vishrambaug) of slums on DP/satellite base. No slum boundary geometry.
- Helps: Prabhag-wise slum share as an area-comparison attribute; slum names could be geocoded.

### OpenCity – Pune Water Distribution Data (WTPs and areas served, 2012)
- Domain: `pmc-open-data` · usefulness: **nice** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-water-distribution-data>
- File: <https://data.opencity.in/dataset/892ccd65-0d95-4f89-ab76-9530eafaa6fd/resource/cb845cf4-e73e-4950-8044-26f99ff27498/download/5148c621-ba7f-4b98-bc6c-66aedbefa059.csv>
- Licence: Other (Public Domain)
- What: Two CSVs (2012): Water Treatment Plants with installed capacity, areas served (e.g. Parvati WTP – old town, Satara Road, Sahakar Nagar) and population; water supplied by sector. No zone polygons. (PMC portal adds a 15-ward per-capita LPCD and supply-hours CSV.)
- Helps: Text description of WTP service areas and ward-wise supply hours can feed a crude 'water reliability' attribute per ward; no spatial zones available.

### OpenCity – Pune Draft City Development Plan 2041 (Vol I & II PDFs)
- Domain: `pmc-open-data` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-draft-city-development-plan-2041>
- File: <https://data.opencity.in/dataset/9abcbbcc-f2c5-490f-b2d8-e533a63b06ca/resource/ea4815af-cd28-4fed-8e43-a07df1307d37/download/1081213c-239f-4359-8123-4f2e1c5dd37f.pdf>
- Licence: Other (Public Domain)
- What: PMC draft City Development Plan 2041, Volume I and II as PDFs (source pmc.gov.in). Land-use maps inside were not inspected; no GIS layers.
- Helps: Reference for land-use context and planned infrastructure; not machine-readable.

### OpenCity – Pune Water Bodies Census 2023 (Jal Shakti, KML points)
- Domain: `pmc-open-data` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/maharashtra-water-bodies-census-data>
- File: <https://data.opencity.in/dataset/abd62847-cb00-4f09-b54c-bd63ee140775/resource/66a4e135-2fc8-4bda-8216-ecc162eb9e29/download/20c62d61-11e7-4eee-8200-6dc0c3fe640b.kml>
- Licence: CC BY-NC 2.0 (non-commercial) – note the restriction
- What: Pune Water Census Map 2023 KML: 3,680 Point placemarks for Pune district (fields village, water_body_type, water_body_nature, waterbody_use, waterbody_encroached, water_spread_area, latitude, longitude). From the 1st Census of Water Bodies (2018-19 survey, released 2023). 6.8 MB.
- Helps: Lakes/ponds as amenity or flood-adjacency points; most of the district points fall outside the city bbox.

### data.gov.in catalogs: Pune Municipal Corporation and PMRDA (OGD India)
- Domain: `pmc-open-data` · usefulness: **nice** · format: api · access: portal_page
- Page: <https://www.data.gov.in/catalog/pune-municipal-corporation>
- Licence: Government Open Data License – India (GODL) / NDSAP
- What: PMC catalog (published/updated 29-09-2025, CDO R. Jagtap; budget 2016-17 to 2025-26 resource seen in search) and PMRDA catalog (https://www.data.gov.in/catalog/pune-metropolitan-region-development-authority, published 12-12-2025, updated 08-01-2026, described as 'spatial, demographic, regulatory and infrastructural data' for PMR; PMRDA's own site links to it as its Open Data Source). Both pages render 'No Result Found' for resources without JavaScript and a 'sandbox environment' banner; WebFetch is blocked (403). Also listed via search: 'Property Tax Data : Pune' and 'Parking lots: Pune' catalogs. Resources therefore unverified.
- Helps: Possible source of PMRDA land-use/zoning tables and PMC property-tax efficiency data; needs a browser session (or the data.gov.in API with a key) to list resources.

### Maharashtra Food & Civil Supplies Dept - District-wise list of Govt & Govt-aided institutions/hostels under Welfare Institutions & Hostels scheme (10.10.2025)
- Domain: `rental-listings` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://mahafood.gov.in/en/past-notices/announcements-general>
- File: <https://cdnbbsr.s3waas.gov.in/s3e21e4e58ad9ab56e8a4634046da90113/uploads/2025/10/202510101192765027.pdf>
- Licence: Government of Maharashtra public notice (open government data; attribute)
- What: 227-page English PDF with a text layer (verified with pypdf). Per-institution rows: name and address, contact phone/email, year of establishment, total capacity, present strength, SC/ST/NT/VJNT/OBC/other hosteller counts, 2/3rd criterion flag, nature of management (Govt owned / Govt aided), vetting line department (Social Welfare, Tribal, WCD, Health). Abstract: Pune DSO 58 institutions (capacity 4,166) + Pune FDO 3 (290). Pune DSO rows are on PDF pages 58-61 (e.g. Jagadishchandra Mahindra Vastigruh Chincholi; Janta Vidyarthi Vastigruh Ghodegaon; Navyug Vidyarthi Vastigruh Bhimnagar Daund; BC/EBC Govt Girls Hostel Rajgurunagar, Pabal Rd; Sant Dnyaneshwar Mauli Magasvargiy Mulanche Hostel Alandi; Mahila Ashram Vastigruh Talegaon Dhamdhere; Govt Prerana Mahila Vastigruh Baramati). Most entries are in rural talukas; only a handful (Alandi, Haveli, Pune FDO) fall inside the 18.40-18.70 / 73.70-74.00 bbox. Earlier editions: 29.05.2025 (https://cdnbbsr.s3waas.gov.in/s3e21e4e58ad9ab56e8a4634046da90113/uploads/2025/05/202505291269225615.pdf) and a scanned 2026 Annexure B (76 pp, image-only, Pune DSO 51 hostels) at https://cdnbbsr.s3waas.gov.in/s3e21e4e58ad9ab56e8a4634046da90113/uploads/2026/06/202606011661072796.pdf.
- Helps: Only official per-hostel government list with addresses, capacity and managing department for Pune district; geocode the Pune DSO/FDO rows for a 'government/aided hostel' layer (mostly peri-urban).

### MKSSS (Maharshi Karve Stree Shikshan Samstha) - Working Women's Hostels, Pune
- Domain: `rental-listings` · usefulness: **useful** · format: html_table · access: manual
- Page: <https://www.maharshikarve.ac.in/Encyc/2023/6/14/working-womens-hostels.html>
- Licence: Institutional website content; attribute
- What: Official institute page listing three working-women hostels in Pune city with locality, capacity and phone: Maitreyee - Hingane Home Colony, Karvenagar (cap 110; 020-25478340, 9665988936); Mahila Niwas - Natubag, Shukrawar Peth (cap 140; 020-24473505); Gargi - Deccan Gymkhana (cap 80; +91-8626025057). Related page on Gargi: https://maharshikarve.ac.in/Encyc/2025/3/12/Gargi.html (mentions a PMC working-women hostel near Bajirao Road run on rent by MKSSS since 2002).
- Helps: Women-only hostel points for the female-student/IT-worker filter and night-safety use case; geocodable by locality.

### Geofabrik OSM extract - India / Western Zone (Maharashtra, Gujarat, Goa, DNH&DD)
- Domain: `rental-listings` · usefulness: **useful** · format: pbf · access: direct_download
- Page: <https://download.geofabrik.de/asia/india/western-zone.html>
- File: <https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf>
- Licence: ODbL 1.0 (OpenStreetMap contributors)
- What: Daily OSM planet sub-extract: western-zone-latest.osm.pbf (211 MB, data up to 2026-10-17), plus western-zone-latest-free.shp.zip (481 MB) and .gpkg.zip (494 MB). Clip to the Pune bbox with osmium extract then osmium tags-filter for building=dormitory, amenity=social_facility (+social_facility=shelter/group_home), tourism=hostel, amenity=student_accommodation, residential=dormitory, name~'PG|Paying Guest|Hostel|Boys|Girls'. Whole-India file (india-latest.osm.pbf, 1.6 GB) also available; no India shapefile.
- Helps: Non-Overpass bulk way to pull the extra OSM accommodation tags (dormitories, social facilities, PG-named buildings) in one reproducible offline pass.

### Overture Maps - Places theme (release 2026-09-23.1)
- Domain: `rental-listings` · usefulness: **useful** · format: api · access: api
- Page: <https://docs.overturemaps.org/guides/places/>
- Licence: CDLA-Permissive 2.0 (places) / Apache 2.0
- What: ~81 M global POIs (mostly Meta/Facebook-sourced, no OSM data) with names.primary, taxonomy (hierarchy/primary/alternates, replaces old categories), basic_category, addresses (freeform, locality, postcode), confidence 0-1, websites/phones, point geometry with bbox columns. Top-level 'lodging' category (2.76 M features) confirmed; hostel/student-housing sub-categories not individually verified. Download a bbox subset with DuckDB (read_parquet from s3://overturemaps-us-west-2/release/2026-09-23.1/theme=places/type=place/*, filter bbox.xmin/xmax/ymin/ymax) or `overturemaps download --bbox=73.70,18.40,74.00,18.70 -f geojson --type=place`. Monthly releases.
- Helps: Captures commercially-named PGs, hostels, co-living operators, messes and offices that are absent from OSM; join by name/distance to enrich the accommodation and nearest-mess layers.

### Punekar News - 'Government Hostels Open Admissions for Backward Class Students in Pune District' (1 Jul 2024)
- Domain: `rental-listings` · usefulness: **nice** · format: html_table · access: manual
- Page: <https://www.punekarnews.in/government-hostels-open-admissions-for-backward-class-students-in-pune-district/>
- Licence: News article (fair-use reference); facts are public government notice
- What: News report of the Social Justice & Special Assistance Dept (Asst. Commissioner Social Welfare, Pune) admission notice: 23 government hostels in Pune district (13 boys, 10 girls); 11 inside Pune + Pimpri-Chinchwad (7 boys, 4 girls), 12 rural. Names two city addresses where forms are issued: Sant Dnyaneshwar Boys Government Hostel, Vishrantwadi, Pune-6 and Sant Janabai Girls Government Hostel, near Commerzone IT Park, Yerwada. Admission now via the HMAS portal (hmasnew.mahait.org, which was down during this check).
- Helps: Confirms the count of state Social-Justice hostels inside the city and gives two geocodable anchor addresses; the remaining 9 urban hostel names must be obtained from the Pune Social Welfare office or HMAS portal.

### HOT Export Tool (export.hotosm.org)
- Domain: `rental-listings` · usefulness: **nice** · format: geojson · access: portal_page
- Page: <https://raw.githubusercontent.com/hotosm/osm-export-tool/master/README.md>
- Licence: ODbL 1.0 (OpenStreetMap contributors)
- What: Web service that exports OSM data for a user-drawn/uploaded polygon with a YAML feature-tag selection; outputs include GeoJSON, CSV, Shapefile, GeoPackage, KML, PBF; synced minutely with OSM; requires an OSM account login. README verified; the app UI at https://export.hotosm.org/ is JS-only.
- Helps: Alternative non-Overpass GeoJSON export of custom tag sets (dormitory, social_facility, hostel, PG names) for the exact Pune bbox.

### Foursquare Open Source Places (FSQ OS Places) on Hugging Face
- Domain: `rental-listings` · usefulness: **nice** · format: other · access: portal_page
- Page: <https://huggingface.co/datasets/foursquare/fsq-os-places>
- Licence: Apache 2.0 (requires accepting dataset terms on Hugging Face)
- What: 100 M+ global POIs, Apache 2.0, Parquet under release/dt=<date>/places/parquet/ and categories/parquet/ (latest dt=2026-10-15; 263 GB total, gated 'accept conditions' on HF; also via places.foursquare.com Iceberg catalog and Snowflake). Fields per schema: fsq_place_id, name, latitude, longitude, address, locality, region, postcode, country, fsq_category_ids/labels, date_created/refreshed/closed. 1,000+ categories; hostel/student-housing categories not individually verified during this check.
- Helps: Second open POI source to cross-check PG/hostel/mess names and phones; filter parquet by lat/lon bbox with DuckDB to keep only Pune.

### Kaggle - Localities of Pune (latitude/longitude)
- Domain: `rental-listings` · usefulness: **nice** · format: csv · access: portal_page
- Page: <https://www.kaggle.com/datasets/yashk12321423dsada/pune-localities-latitudes-and-longitudes>
- Licence: CC0 1.0 Public Domain
- What: Tiny CC0 CSV (961 bytes, July 2023) with columns locality, latitude, longitude for Pune localities (count not stated; ~25-30 rows by size).
- Helps: Quick locality-name-to-centroid lookup for joining rent tables (ANAROCK/Quikr/Knight Frank) to map points before building proper polygons from OSM place nodes.

### Kaggle - Indian Rental House Price (bhavyadhingra00020)
- Domain: `rental-listings` · usefulness: **nice** · format: csv · access: portal_page
- Page: <https://www.kaggle.com/datasets/bhavyadhingra00020/india-rental-house-price>
- Licence: Apache 2.0 (per Kaggle metadata)
- What: India-wide rental listings scraped April 2024 (0.87 MB zipped, Apache 2.0 per Kaggle API; last updated 2024-04-07). Search-engine description lists fields house type, size, location, city, latitude, longitude, price, bathrooms, balconies, furnishing, deposit. The Kaggle page did not render through the fetcher, so Pune row-count and the lat/lon columns could not be confirmed directly.
- Helps: If the Pune subset is non-trivial, it is the only open listing table with ready lat/lon; filter city=='Pune' and clip to bbox.

### Kaggle - Pune House Rent Prediction (rahulmishra5)
- Domain: `rental-listings` · usefulness: **nice** · format: csv · access: portal_page
- Page: <https://www.kaggle.com/datasets/rahulmishra5/pune-house-rent-prediction>
- Licence: Unknown (uploader did not specify; derived from makaan.com) - use only as a cross-check, not as a redistributable layer
- What: Pune rent listings (1.4 MB, Feb 2022) with bedrooms, bathrooms, location (locality text), area, furnished status; extracted from makaan.com with a Chrome scraper; licence 'Unknown' on Kaggle, no coordinates.
- Helps: Cross-validation of locality-level 2021-22 rent medians against the CC0 Anant Sakhare dataset; not suitable as a primary layer because of unclear licence.

### IGR Maharashtra - e-ASR Annual Statement of Rates (ready reckoner) + ASR guideline PDFs
- Domain: `rental-listings` · usefulness: **nice** · format: api · access: portal_page
- Page: <https://igrmaharashtra.gov.in/Home/asr_guidelines>
- Licence: Government of Maharashtra public data (manual lookup; no stated redistribution restriction)
- What: Official Dept. of Registration & Stamps lookups: e-ASR 1.9 (https://easr.igrmaharashtra.gov.in/) and e-ASR 2.0 beta (https://igreval.maharashtra.gov.in/eASR2.0/) give government valuation rates per value-zone/village/CTS for Pune city, Haveli etc. (interactive, no bulk download, select district > taluka > village/zone). The guidelines page lists downloadable PDFs: ASR Guidelines 2026-27 and 2025-26 (Mumbai / Rest of Maharashtra), earlier years, and a 'List of villages in influenced area - Pune' PDF (https://igrmaharashtra.gov.in/pdf/documents/3_ASR_VillageList_Pune.pdf). Press reports: Pune rates +4.16% for FY2025-26; frozen for 2026-27.
- Helps: Official property-value zoning per locality; a defensible proxy for 'expensive vs affordable' area ranking when listing rents are sparse.

### Savitribai Phule Pune University - Hostel section (capacity, rules, campus map)
- Domain: `rental-listings` · usefulness: **nice** · format: html_table · access: manual
- Page: <https://unipune.ac.in/university_files/hostel_Capacity.htm>
- Licence: University website, public
- What: Official SPPU pages: 10 ladies' hostels (1,736 seats), 9 gents' hostels (1,689 seats), 1 upcoming (600) on the Ganeshkhind campus; campus map (https://unipune.ac.in/university_files/campus_map.htm) numbers each hostel; hostel details page links rules PDFs, department-wise quota PDFs and admission calendar. No street addresses and no list of recognised private PGs.
- Helps: On-campus hostel capacities for the SPPU node (student-demand weighting), not for PG discovery.

### Fergusson College - About Hostel (on-campus hostels)
- Domain: `rental-listings` · usefulness: **nice** · format: html_table · access: manual
- Page: <https://fergusson.edu/about-hostel>
- Licence: College website, public
- What: Official page: 7 hostel blocks on the 65-acre FC Road campus (Pune 411004) with strength: Block I 107, II 107, III 117, IV 115 (boys); Birla Block 72, Agarkar Block 184, Bungalow IV 17 (girls); totals 446 boys / 273 girls. 2026-27 admission notices and merit-list PDFs linked from https://fergusson.edu/?p=7304. Rector office 020-67656000.
- Helps: Capacity attribute for the Fergusson college node; shows how little on-campus supply exists relative to demand.

### COEP Technological University - First-Year B.Tech Hostel Admission Notification AY 2026-27 (PDF)
- Domain: `rental-listings` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://www.coeptech.ac.in/wp-content/uploads/2026/08/first-year-btech-hostel-admission-notification-AY-2026-27-boys-and-girls-with-hostel-application-form.pdf>
- File: <https://www.coeptech.ac.in/wp-content/uploads/2026/08/first-year-btech-hostel-admission-notification-AY-2026-27-boys-and-girls-with-hostel-application-form.pdf>
- Licence: University notice, public
- What: 6-page official PDF dated 04/08/2026 (text verified): hostel dept at Shivajinagar, Pune 411005; fee Rs 50,000/yr (Rs 1,27,000 NRI), Rs 10,000 security + Rs 7,000 mess deposit; students residing in PMC/PCMC limits are not eligible for hostel - i.e. local students must find PGs. Seat matrix PDF: https://www.coeptech.ac.in/wp-content/uploads/2026/09/F.Y.-B.-Tech.-B.Plan-Hostel-Admission-BOYSGIRLS-A.Y-2026-27-Schedule-Seat-Matrix-1.pdf
- Helps: Benchmark on-campus hostel cost (~Rs 4,200/month) and eligibility rule that pushes PMC/PCMC students into the PG market near Shivajinagar.

### IISER Pune Mathematics PhD - Accommodation options page
- Domain: `rental-listings` · usefulness: **nice** · format: html_table · access: manual
- Page: <https://sites.iiserpune.ac.in/~mathphd/aco.html>
- Licence: Institute website, public
- What: Institute page listing 5 nearby stays with addresses/phones: IISER hostel (Rs 200/day shared), VAMNICOM guest house, Ganeshkhind Rd (~Rs 600/night, 020-66221400), Bhaskaracharya Pratishthan, 56/14 Damle Rd, Erandwane 411004 (020-25434547), Hotel Sheetal Palace and Hotel Bhairavee on Baner Rd 411045. Undated.
- Helps: A few geocodable short-stay/guest-house points around Pashan-Baner for the IISER node; low value otherwise.

### Pune City Police – official police station directory JSON API (45 stations, addresses, phones, Google-Maps coordinates)
- Domain: `safety` · usefulness: **core** · format: api · access: api
- Page: <https://admin.punepolice.gov.in/api/ps>
- File: <https://admin.punepolice.gov.in/api/ps>
- Licence: Government public information published by Pune City Police (Govt of Maharashtra); no explicit open licence text found – see https://punepolice.gov.in/disclaimer before redistribution
- What: Undocumented but public JSON backend of punepolice.gov.in ('Find your police station' widget). GET /api/ps returns {ps:[45 records]} with fields: id, name (Marathi), address (Marathi), phone, phone2, whatsapp, email, email_2, incharge, sub_division, division (id), population, wireless_mo, beat_marsh, map_link (Google Maps embed URL whose pb parameter carries lon in !2d and lat in !3d, e.g. Alankar 18.49839,73.82399), photo. Includes the 2024-25 new stations (Ambegaon 34, Nanded City 35, Baner 36, Kharadi 37, Wagholi 38, Kalepadal 39, Fursungi 40, Manjari 42, Narhe 43, Lohgaon 45, Cyber 47, Laxminagar 48, Yevalewadi 49). GET /api/ps?ps=<id> returns the full record incl. English name, name_di (division e.g. 'Sinhagad Road Division'), phone_div, name_zo (zone I–V), officer name/post/mobile, and the station's police chowkies: chname + chphone, chowki2..chowki8 + chphone2..8 (e.g. Hadapsar: Magarpatta, Tukai, Fursungi, Manjari; Alankar: Alankar 020-26208430, Dahanukar). map_link is null for a few new stations (e.g. Baner). Records last updated 2019 for older stations. Verified by opening /api/ps, /api/ps?ps=1, ?ps=10, ?ps=36.
- Helps: Nearest police station / chowky lookup, police-station jurisdiction attribute (division, zone), night-safety score input; geocode via map_link coordinates or address

### Pune City Police – Road Safety Report 2024 (BIGRS) with 110 geocoded black spots
- Domain: `safety` · usefulness: **core** · format: pdf · access: direct_download
- Page: <https://admin.punepolice.gov.in/files/CitizenAlert/228.pdf>
- File: <https://admin.punepolice.gov.in/files/CitizenAlert/228.pdf>
- Licence: Government report published by Pune City Police; no explicit licence – cite source
- What: 27-page official report (Pune Police + Bloomberg Philanthropies Initiative for Global Road Safety), listed on the Citizen Alert Wall as 'पुणे शहर रस्ते सुरक्षा अहवाल २०२४'. Text-extractable. Pages 15-16: Top 20 black spots 2022-2024; pages 18-23 Annexure-1: all 110 black spots with Sr.No, Rank, Name of Black Spot, Latitude, Longitude (WGS84 decimal, e.g. 'In front of Hadapsar Police Station' 18.50054, 73.939617), fatal crashes, serious-injury crashes, total, people died, seriously injured (2022-2024). Also 2019-2024 fatality trend (341 deaths, 819 serious injuries in 2024), hit-and-run share, time-of-day/day-of-week distribution, heat map, and high-risk corridors (Pune-Solapur, Pune-Ahmednagar, Mumbai bypass, Pune-Satara, Pune-Saswad) with deaths/km.
- Helps: Accident black-spot point layer (110 points with lat/lon and severity counts) for night-safety score and area comparison

### Pune City Police – Road Safety Report 2022-2023 with 80 geocoded black spots
- Domain: `safety` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://admin.punepolice.gov.in/files/CitizenAlert/192.pdf>
- File: <https://admin.punepolice.gov.in/files/CitizenAlert/192.pdf>
- Licence: Government report published by Pune City Police; no explicit licence – cite source
- What: 34-page official BIGRS report ('पुणे शहर रस्ता सुरक्षा अहवाल सन 2022 ते 2023'), text-extractable. Section 3.14.2 Table 11 Top-20 black spots 2022-2023 and Annexure-1 'List of Black Spots of Pune City (2022-2023)' with 80 locations, each with Rank, Name of Location, Latitude, Longitude, fatal crashes, SI crashes, deaths, seriously injured. Also JH-IIRU observational findings (speeding, helmet use).
- Helps: Earlier black-spot layer for temporal comparison / validation of 2024 list

### Pune City Police – Citizen Alert Wall (index of official PDFs, incl. road-safety reports, 7-new-police-stations order, RTI station info, Annual Performance Report 2019)
- Domain: `safety` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://punepolice.gov.in/citizen-corner/citizen-alert-wall>
- Licence: Government public information, Pune City Police
- What: React page (3 pages, ~230 items) linking PDFs under https://admin.punepolice.gov.in/files/CitizenAlert/<n>.pdf. Relevant items confirmed: 228 (Road Safety Report 2024), 192 (2022-23), 183 (2021-23), 182 (2019-22), 190 ('७ नवीन पोलीस ठाणे' – scanned 10-page govt order creating 7 new police stations, no text layer), 47 (Annual Performance Report 2019, English, 56 pp: city-wide IPC registration 8,677 in 2019, body/property/women crime heads, chain snatching, vehicle theft, 30 stations covering 331.3 sq km, beat-marshal response time, Security Perception Index), 48 (same in Marathi), and per-station RTI Section 4(b) disclosures (Khadak 225, Shivajinagar 224, Vishrantwadi 223, Sahakarnagar 222, Deccan 221, Yerwada 220, Vishrambaug 219, Mundhwa 218, Lonikand 217, Ambegaon 216, Sinhgad 210, Faraskhana 209, Hadapsar 208, Bibwewadi 206, Alankar 205, Samarth 204, Market Yard 203, Chaturshringi 201, Wagholi 197). Site is a JS SPA: WebFetch returns only the title, use a browser or hit the PDF URLs directly.
- Helps: Discovery index for all official Pune Police safety documents; RTI station PDFs describe each station's jurisdiction area

### OpenCity – Pune Streetlights: ward-wise number of street lights (PMC open-data mirror)
- Domain: `safety` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-streetlights>
- File: <https://data.opencity.in/dataset/c91fa694-5d22-4efd-a0b7-993a42c69966/resource/24458e14-2139-4348-ab4c-0df81dfb5bb0/download/a7f9edd5-8709-4022-bae6-8197274886e5.csv>
- Licence: Other (Public Domain) – Open Definition conformant
- What: CSV, 15 rows = PMC administrative ward offices (Nagar Road, Dhole Patil, Yerwada, Aundh, Ghole Road, Kothrud-Bavdhan, Dhankawadi, Sinhagad Road, Warje-Karve Road, Hadapsar, Wanwadi-Ramtekadi, Kondhwa-Yewalewadi, Kasba-Vishrambaug, Bhavani Peth, Bibwewadi) grouped in Zones 1-5. Columns: Number of Poles, No. of LED Bulbs, No. of poles with conventional lights, Total length of roads (km), street lights per km (61-62), streets with adequate lighting (NA). Source opendata.punecorporation.org; added Feb 2024, updated Nov 2025. No pole-level geometry.
- Helps: Ward-level lighting density factor for the night-safety score (join to PMC administrative ward polygons)

### OpenCity – PMC Wards Info (administrative wards 2017, electoral wards 2012/2017/2022/2025, prabhag and zone KMLs)
- Domain: `safety` · usefulness: **useful** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-wards-info>
- File: <https://data.opencity.in/dataset/98f28dac-9158-46ee-a91e-a514d9af427c/resource/686cd9cd-012f-4f97-913f-8c7003b3eb02/download/b26b0ee3-60a3-4f1a-a45c-94b24fb9434a.kml>
- Licence: Other (Public Domain) – Open Definition conformant
- What: Seven KML files from PMC: Pune Administrative Wards Map 2017 (15 ward offices – matches the streetlight CSV), Electoral Wards 2012 (76), 2017 (41), 2022 (58), 2025 (41), PMC Prabhag Boundary, PMC Zones map (4 zones). Created Mar 2023, updated Nov 2025.
- Helps: Polygons to spatialise the ward-wise streetlight counts and to aggregate safety indicators per ward for area comparison

### Parisar – PMC black spot list (Maharashtra Highway Police 'Black Spot Series-3, 2019-2021', 34 PMC spots)
- Domain: `safety` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://parisar.org/what-we-do/road-safety/analysis-reports/parisar-participated-in-black-spot-inspection-activity-in-pune-city>
- File: <https://drive.usercontent.google.com/download?id=1MQHbJTCxEwGGfyUuzlLSPd5uaS47l68G&export=download>
- Licence: Government data (Maharashtra Highway Police / District Road Safety Committee) redistributed by Parisar; no explicit licence – use as reference table
- What: Parisar (Pune road-safety NGO) page on the Nov 2023 District Road Safety Committee black-spot inspection, linking two Google-Drive PDFs. PMC file (2 pages, text-extractable): 34 black spots in Pune City with Sr.No, traffic unit, jurisdictional police station (Hadapsar, Warje, Sinhgad, Bharti Vidyapith, Vimantal, Chandan Nagar, Mundhwa, Kondhwa, Yerwada, Koregaon Park, Bund Garden, Shivajinagar...), road class (NH-65/NH-4/NH-965/SH-27/Other), location name (e.g. Navale Bridge, Katraj Chowk, Kharadi Bypass Chowk, Mundhwa Railway Bridge, Khadakwasla), stretch limits (m), accidents and fatalities per year 2019/2020/2021 and responsible authority (PMC/NHAI/PWD). No coordinates. PCMC file: 19 spots (Hinjewadi, Chakan, Dehu Road, Talegaon, Nigdi, Bhosari PS areas) same schema.
- Helps: Black spots tagged with jurisdictional police station and road class; complements the geocoded 2024 list; PCMC list covers the northern part of the bbox (Hinjewadi/Wakad)

### OpenCity – Crime in India 2023 (NCRB) full report and city-wise tables (public-domain mirror)
- Domain: `safety` · usefulness: **useful** · format: pdf · access: direct_download
- Page: <https://data.opencity.in/dataset/crime-in-india-2023>
- File: <https://data.opencity.in/dataset/40449a25-7fb3-4e38-91b9-f834af6078e2/resource/b7c71212-9463-4407-ab63-f349403a75b6/download/4f02eaf8-5d55-43d9-9a23-09cd724b5566.pdf>
- Licence: Other (Public Domain) – NCRB government publication, Open Definition conformant
- What: ~110 resources: Crime in India 2023 Vol 1 and Vol 2 PDFs plus ~30 XLSX and ~80 PDF city tables. Caveat verified by extraction: the standalone 'IPC Crimes (City-wise) 2021-2023', 'IPC & SLL (City-wise)' and 'Crime Against Women (City-wise)' PDFs cover only the 34 cities of 1-2 million population (Agra…Varanasi) and do NOT contain Pune; Pune (population 2M+) is in the 19-metropolitan-city tables inside Vol 1 (Tables 1A.3/1A.4, 3A.3, 19A etc.). XLSX files such as 'City-wise Cases Registered 156_3 under IPC during 2023' and 'City-wise Persons Disposal under IPC Crimes 2023' should be checked for the 19-city set. Vol 1: https://data.opencity.in/dataset/40449a25-7fb3-4e38-91b9-f834af6078e2/resource/b7c71212-9463-4407-ab63-f349403a75b6/download/4f02eaf8-5d55-43d9-9a23-09cd724b5566.pdf ; Vol 2: .../resource/7ac7f9fc-7567-4c5d-8a24-9777b9f47519/download/cb95d6e0-f96a-41df-80c0-92ab2fbd74f5.pdf ; IPC 156_3 XLSX: .../resource/c0e711e8-f657-4290-ad68-10a091a0abe6/download/b705a8a3-1773-4f51-b210-316791d0193e.xlsx
- Helps: City-level crime rate / crimes-against-women reference numbers for Pune to calibrate or explain the safety score (not spatial below city level)

### Pune City Police – Road Safety Situation 2021-2023 factsheet
- Domain: `safety` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://admin.punepolice.gov.in/files/CitizenAlert/183.pdf>
- File: <https://admin.punepolice.gov.in/files/CitizenAlert/183.pdf>
- Licence: Government report published by Pune City Police; no explicit licence
- What: 14-page BIGRS factsheet. 2021-2023 fatal crash totals (229/310/350), 327→370 fatalities, road-user split, hit-and-run 53%, heatmap, and top-20 black spot section (names, no coordinates). Text-extractable.
- Helps: Reference statistics for the safety methodology page; superseded by the 2024 report for geometry

### Pune City Police – Road Safety Situation 2019-2022 factsheet (Top 20 blackspots table)
- Domain: `safety` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://admin.punepolice.gov.in/files/CitizenAlert/182.pdf>
- File: <https://admin.punepolice.gov.in/files/CitizenAlert/182.pdf>
- Licence: Government report published by Pune City Police; no explicit licence
- What: 10-page BIGRS factsheet. Pages 9-10: ranked table of top 20 black spots 2019-2022 with Fatal crashes, Grievous-injury crashes, Total crashes, Total fatalities (names only, e.g. Katraj Chowk, Navale Bridge bus stop, Mundhwa Chowk; no coordinates), heat map, MoRTH black-spot definition. Trend: 173 deaths 2019 → 327 in 2022.
- Helps: Historic black-spot names for cross-checking persistent hotspots

### Pune City Police website JS bundle – hard-coded police station coordinates array
- Domain: `safety` · usefulness: **nice** · format: other · access: direct_download
- Page: <https://punepolice.gov.in/static/js/main.e657ab13.chunk.js>
- File: <https://punepolice.gov.in/static/js/main.e657ab13.chunk.js>
- Licence: Government website content (Pune City Police); no explicit licence
- What: The site's React bundle (358 KB) contains a literal array `He=[{id,name,lat,lng},...]` of 33 stations with WGS84 lat/lng used for the Leaflet map (e.g. Alankar 18.498433,73.826164; Hadapsar 18.500435,73.939588; Yerwada 18.552575,73.896014; Lonikalbhor 18.48636,74.02682; Lonikand 18.6201,74.0231). Two entries have wrong coordinates (Market Yard 16.216,77.361; 'Uttam Nagar East' 28.625,77.065 – a Delhi station) and the 2024-25 new stations are missing; ids match /api/ps ids. Bundle filename may change on redeploy.
- Helps: Quick fallback coordinates for stations whose map_link is null; cross-check against OSM amenity=police

### Dataful (Factly) – NCRB metropolitan-city IPC crimes, crime rate and chargesheet rate 2001-2023 (CSV/XLSX)
- Domain: `safety` · usefulness: **nice** · format: csv · access: portal_page
- Page: <https://dataful.in/datasets/22522>
- Licence: Not stated (Dataful terms and conditions; underlying NCRB data is government open data)
- What: Tidy long-format table compiled from NCRB Crime in India: year (2001-2023), state, city (55 metropolitan cities incl. the 19 mega cities), category (Total IPC crimes, population, rate of cognizable crimes, chargesheeting rate), value, unit, note; 2,228 rows x 7 cols, updated Dec 2025, CSV/XLSX/Parquet/JSON. Sister dataset 23184: crimes against senior citizens by city and crime head 2016-2023 (3,759 rows). Licence not stated on page; downloads shown without login but Dataful has a sign-in – verify terms.
- Helps: Ready-to-load time series of Pune city crime rate for the safety-score explainer; avoids parsing NCRB PDFs

### Safetipin – Safety Audits in Pune 2019 (methodology deck, Pune Smart City / IUDX women-safety audit)
- Domain: `safety` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://safetipin.com/wp-content/uploads/2021/12/safety-audits-in-pune-safetipin-2019.pdf>
- File: <https://safetipin.com/wp-content/uploads/2021/12/safety-audits-in-pune-safetipin-2019.pdf>
- Licence: Copyright Safetipin (not an open licence) – use as methodological reference only; raw audit data available only on request/through IUDX
- What: 20-slide PDF. Pune city-wide Safetipin Nite audit: 52,280 night images, 650 km of road, 6,632 safety audit points; ABD area (Aundh-Baner-Balewadi): 10,862 images, 160 km, 1,564 audits. Nine parameters (lighting, openness, visibility, people, security, walk path, public transport, gender usage, feeling); average parameter rating chart; example locations (no streetlight at PAN Card Club Road; Abhimanshree Road). No per-point data table or download; the point data went to the Pune IUDX platform (secure access). Related 8-city report page: https://safetyscore.safetipin.com/projects/7/how-safe-is-your-city-safety-audit-report-of-8-cities/ (links a >10 MB PDF 'Safety Audit Report of 8 Cities.pdf', not inspected).
- Helps: Defines the lighting/visibility/people/transport parameters that the PuneStay night-safety score can mimic with OSM street lamps, POIs and bus stops

### OpenCity – Pune Fire Stations map (KML) and fire-call statistics 2011-2020
- Domain: `safety` · usefulness: **nice** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-fire-stations>
- File: <https://data.opencity.in/dataset/49fd476d-ace4-4610-918c-cb09f4171cb2/resource/201f577f-a095-4313-b724-ae3ec3587fe7/download/d185bb0c-2307-4a7d-9106-11cd61570165.kml>
- Licence: Other (Public Domain) – Open Definition conformant
- What: KML with 14 placemarks (Name_of_Facility: Pune Cantonment, Erandwana, Kasba, Kothrud, Dayaram Rajguru, Aundh, Fire Brigade Main Office, Katraj, Sinhgad Road, Hadapsar, Yerwada, plus 3 unnamed) with lon/lat coordinates (e.g. Katraj 73.85812,18.453797); CSV of fire-service calls 2011-2020. Source PMC open data portal.
- Helps: Optional 'nearest emergency service' layer alongside police stations and hospitals

### Maharashtra Police – state, commissionerate, district and railway police control-room directory (PDF)
- Domain: `safety` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://www.mahapolice.gov.in/uploads/contact_email/743f2f0a6891748aca453b5432a98ce2.pdf>
- File: <https://www.mahapolice.gov.in/uploads/contact_email/743f2f0a6891748aca453b5432a98ce2.pdf>
- Licence: Government public information (Maharashtra Police)
- What: 4-page PDF (2021): control-room landline, fax and WhatsApp numbers for all units. Pune City: 020-26126296 / 26122880 / 26122202, WhatsApp 8975283100 / 8975953100; Pimpri-Chinchwad City: 020-27352600/27352500, WhatsApp 9529691966; Pune Rural: 020-25657171; Pune Railway: 020-25541631. No station-level entries.
- Helps: Emergency contact panel in the app (control room / WhatsApp numbers), also for Pimpri-Chinchwad part of the bbox

### Pune District (pune.gov.in) – disaster management and emergency control-room numbers
- Domain: `safety` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://pune.gov.in/?p=2778>
- Licence: Government of Maharashtra / NIC district portal (GIGW public content)
- What: District portal page (updated 06-11-2025) listing ~16 emergency contacts: District Disaster Control Room 1077 / 020-26123371, Police Control Room 112, Pune City Police 020-26122880/26126296, Fire Brigade 101, PCMC control room 020-67331111, Pune-Mumbai Expressway control room. No addresses or coordinates.
- Helps: Emergency helpline panel

### Wikipedia – Pune Police (organisation: regions, zones, divisions, HQ)
- Domain: `safety` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://en.wikipedia.org/wiki/Pune_Police>
- Licence: CC BY-SA 4.0
- What: Encyclopaedic page: HQ 2 Sadhu Vaswani Road, Camp; 2 regions, 4-5 zones (DCP), 9 sub-divisions (ACP) each with 3-4 stations; station count 30 (pre-2024). Does not list individual stations; cites archived 2011 punepolice.gov.in jurisdiction page (web.archive.org could not be fetched from this environment).
- Helps: Background text for the police-station hierarchy shown in the app

### MyPunePulse – 'Pune Police identifies 165 sensitive spots for women' (Jul 2024, Women's Safety Committee)
- Domain: `safety` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://www.mypunepulse.com/?p=95863>
- Licence: News article (copyright publisher) – use only as a reference table of counts, cite source
- What: News report (6 Jul 2024) of the Pune Police Women's Safety Committee hotspot survey: ~165 sensitive spots for women; counts per police-station area (Khadak 4, Samarth 6, Faraskhana 6, Vishrambag 4, Shivajinagar 11, Deccan 5, Swargate 5, Lashkar 4, Sahakarnagar 6, Bharati Vidyapeeth 4, Bund Garden 5, Koregaon Park 4, Warje Malwadi 2, Kothrud 2, Alankar 4, Parvati 10, Sinhagad Road 4). No street-level locations or coordinates; the official list (later 274 spots sent to PMC for lighting/CCTV) is not published.
- Helps: Per-police-station count of women-safety hotspots as a weak prior in the night-safety score

### Copernicus GLO-30 DEM tile N18_E073 (AWS Open Data, copernicus-dem-30m)
- Domain: `terrain-flood` · usefulness: **core** · format: geotiff · access: direct_download
- Page: <https://copernicus-dem-30m.s3.amazonaws.com/?prefix=Copernicus_DSM_COG_10_N18_00_E073>
- File: <https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N18_00_E073_00_DEM/Copernicus_DSM_COG_10_N18_00_E073_00_DEM.tif>
- Licence: Copernicus DEM licence: free for the general public; attribution required: '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved' (https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM; registry page https://registry.opendata.aws/copernicus-dem/)
- What: 1 arc-second (~30 m) Cloud-Optimized GeoTIFF DSM, 2021 release, 1x1 degree tile 18-19N / 73-74E which contains the entire PuneStay bbox. S3 listing confirmed 16 keys incl. DEM.tif (45,785,199 bytes), AUXFILES WBM (water body mask), EDM, FLM, HEM, and KML footprints; LastModified 2022-05-09. Heights EGM2008 (EPSG:3855), horizontal WGS84 EPSG:4326, float32. Tile naming Copernicus_DSM_COG_10_<N/S lat>_00_<E/W lon>_00_DEM. No AWS account needed (aws s3 ls --no-sign-request s3://copernicus-dem-30m/). Also reachable as demtype=COP30 through OpenTopography.
- Helps: Primary elevation raster for PostGIS: slope, HAND (height above nearest drainage), low-lying/waterlogging susceptibility input to the flood component of area comparison and the listing-level 'flood risk' badge; also hillshade/terrain in MapLibre.

### PMC Flood Control and Disaster Management Action Plan 2025 (Pune Municipal Corporation Disaster Management Cell)
- Domain: `terrain-flood` · usefulness: **core** · format: pdf · access: direct_download
- Page: <https://webadmin.pmc.gov.in/en/node/13953>
- File: <https://webadmin.pmc.gov.in/sites/default/files/2026-02/flood_control_and_disaster_management_action_plan_2025_0.pdf>
- Licence: Government of Maharashtra / PMC public document (PMC endorses NDSAP open data policy); cite PMC Disaster Management Cell
- What: Official 149-page Marathi PDF (6.78 MB, posted Feb 2026). Text-extractable with pypdf except pp.12-48 and p.107 which are scanned images (p.107 = flood-control map; pp.12-48 likely the '127 potentially affected settlements' list referenced on p.8 - needs OCR). Confirmed contents: 24x7 PMC flood control room 020-25506800 / 25501269 / 6780150; warning thresholds (Khadakwasla release >=20,000 cusecs = alert, >=40,000 = evacuation measures; Mulshi level >1,980 ft); Bund Garden gauge levels (general flood RL 541.00 m, emergency RL 542.00 m / 545.00 m, danger 545.83 m at 1,68,558 cusecs); Blue/Red line design discharges (Mutha Khadakwasla-to-confluence 60,000 / 1,00,000 cusecs; Mula-Mutha confluence-to-Mundhwa 1,18,000 / 1,68,000; Pavana 54,208 / 88,711 and 58,941 / 96,692); table of Mutha discharge vs. flooded spots (18,000 Bhide bridge; 28,000 Khilare Vasti; 33,000 Shitaladevi Mandir; 54,000 new PMC bridge; 60,000 Patil Estate); 39-row table (pp.115-116) of localities inundated at 30,000-55,000 cusecs on Mutha left/right bank, Mula bank (Kalas, Yerawada Shantinagar/Indiranagar, Aundh old bridge, Bopodi Harris bridge, Sangamwadi, Patil Estate) and others (Mundhwa Keshavnagar, Dhankawadi KK Market, Swargate canal); ward-office-wise list of 2024 waterlogged areas (p.117); list of 71 relief centres = named PMC schools/halls with the locality each serves and ward office (pp.73-77); dam table (Mulshi, Pavana, Kasarsai, Temghar, Varasgaon, Panshet, Khadakwasla capacities and spillway cusecs); L0-L4 flood alert levels. Mirror of www.pmc.gov.in which returns a malformed header to fetchers.
- Helps: Single authoritative source for: (1) geocodable flood-prone localities with the discharge at which they flood -> night-safety/flood score per listing; (2) 71 monsoon relief shelters (school names) -> 'nearest flood shelter' POI layer; (3) official Blue/Red line discharge values and dam/gauge thresholds for any live-alert feature. Needs Marathi transliteration + geocoding and OCR of pp.12-48.

### Copernicus EMS Global Flood Monitoring (GFM) Sentinel-1 flood extent - Pune, 25 July 2024 (EODC STAC)
- Domain: `terrain-flood` · usefulness: **core** · format: geotiff · access: api
- Page: <https://stac.eodc.eu/api/v1/search?collections=GFM&bbox=73.7,18.4,74.0,18.7&datetime=2024-07-24T00:00:00Z/2024-07-28T23:59:59Z&limit=5>
- File: <https://data.eodc.eu/collections/GFM_LAYERS/flood_extent/AS020M/2024/07/25/ENSEMBLE_FLOOD_20240725T004720_VV_AS020M_E021N018T3.tif>
- Licence: Copernicus free and open data policy; documentation CC BY 4.0
- What: STAC query confirmed 3 items for the Pune bbox on 2024-07-25 (the Khadakwasla 35,000-45,000 cusecs release day): ENSEMBLE_FLOOD_20240725T004720_VV_AS020M_E021N018T3 etc., 20 m Equi7 Asia grid tile E021N018T3, 14 assets each (ensemble_flood_extent, ensemble_water_extent, exclusion_mask, reference_water_mask, likelihood, advisory_flags, tilejson/thumbnail via TiTiler). Archive covers all Sentinel-1 IW scenes over land from 1 Jan 2015 to present, so other Pune events (e.g. 25 Sep 2019, Sept 2026) can be pulled with the same query. STAC endpoint https://stac.eodc.eu/api/v1, collection GFM; API https://api.gfm.eodc.eu/v2/; portal https://portal.gfm.eodc.eu/. Product user manual (CC BY 4.0) at https://extwiki.eodc.eu/gfm_assets/gfm4.0_pum_2025.pdf. SAR flood detection in dense urban areas is uncertain (use exclusion_mask and likelihood layers).
- Helps: Only machine-readable observed flood footprint for Pune: rasterize/vectorize into PostGIS as a 'historically flooded (2024-07-25)' polygon layer and intersect with PG/hostel locations and nalla buffers for the flood component of the safety/area scores.

### Pune Stormwater Drains, Nallas and River maps (PMC via OpenCity.in)
- Domain: `terrain-flood` · usefulness: **core** · format: kml · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-stormwater-drains>
- File: <https://data.opencity.in/dataset/a83b2053-2250-4e3c-9759-521c81679d24/resource/b9bdda98-a0d1-4e2e-aca3-36c6445751b5/download/3f7228b1-092e-4c66-a62f-6895cf33fbcd.kml>
- Licence: Other (Public Domain) per OpenCity; source PMC
- What: Five PMC-sourced vector files for the PMC area, public domain, created Nov 2025: PMC Stormwater Drains Map (KMZ), Pune Nalla Map (KML - all nallas/streams), Pune River Map (KML - Mula/Mutha main waterbody), Pune SWD Utility Chambers (KML), PMC SWD Chambers (KML). Direct URLs: SWD KMZ https://data.opencity.in/dataset/a83b2053-2250-4e3c-9759-521c81679d24/resource/7b7bb529-d324-48c2-95eb-8eabbab4381b/download/4390b641-12ad-4438-bc6b-c938ea7ae5de.kmz ; River KML https://data.opencity.in/dataset/a83b2053-2250-4e3c-9759-521c81679d24/resource/7507f222-3bcd-4881-b558-90c5cbc2625f/download/b0d9ef1f-14d7-4c93-a498-3ffb7c86737c.kml ; chambers KMLs on the dataset page. Survey year not stated.
- Helps: Official nalla network (Ambil Odha, Bhairoba nalla, Ram Nadi etc.) for 'distance to nalla/river' flood-risk buffers around each PG; river polygon for Blue-line-like proximity; SWD coverage as a drainage-quality indicator per locality.

### NASADEM_HGT v001 tile n18e073 (NASA LP DAAC via CMR)
- Domain: `terrain-flood` · usefulness: **useful** · format: other · access: direct_download
- Page: <https://cmr.earthdata.nasa.gov/search/granules.json?short_name=NASADEM_HGT&version=001&bounding_box=73.7,18.4,74.0,18.7>
- File: <https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/NASADEM_HGT.001/NASADEM_HGT_n18e073/NASADEM_HGT_n18e073.zip>
- Licence: NASA/LP DAAC open data, no restrictions; cite DOI 10.5067/MEaSUREs/NASADEM/NASADEM_HGT.001; Earthdata login required
- What: NASADEM merged DEM, 1 arc-second, reprocessed SRTM with voids filled; CMR returned two granules for the bbox: NASADEM_HGT_n18e073 (12.17 MB zip, covers the whole bbox) and n18e074 (not needed). Zip contains .hgt, .num, .swb (water mask). Collection C2763264762-LPCLOUD. Download needs a free NASA Earthdata login (HTTPS or S3 with temporary credentials).
- Helps: Alternative/validation DEM (void-filled SRTM) if a DTM-like surface is preferred over the Copernicus DSM for drainage/HAND; .swb water mask is a bonus.

### SRTM 1 Arc-Second Global v003 tile N18E073 (SRTMGL1, LP DAAC via CMR)
- Domain: `terrain-flood` · usefulness: **useful** · format: other · access: direct_download
- Page: <https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SRTMGL1&version=003&bounding_box=73.7,18.4,74.0,18.7>
- File: <https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/SRTMGL1.003/N18E073.SRTMGL1.hgt/N18E073.SRTMGL1.hgt.zip>
- Licence: US Government public domain (USGS/NASA); Earthdata login required for this endpoint
- What: NASA SRTM GL1 v3 (void-filled) 1 arc-second .hgt tile N18E073 (12.06 MB zip) covering the whole bbox; also N18E074. HTTPS download requires free Earthdata login. Same data is served without login through OpenTopography (demtype=SRTMGL1) and USGS EarthExplorer.
- Helps: Classic 30 m DEM for cross-checking elevation/low-lying areas; many flood-susceptibility tutorials assume SRTM.

### OpenTopography Global DEM API (SRTMGL1 / NASADEM / COP30 / AW3D30 clipped to bbox)
- Domain: `terrain-flood` · usefulness: **useful** · format: api · access: api
- Page: <https://portal.opentopography.org/API/globaldem?demtype=SRTMGL1&south=18.4&north=18.7&west=73.7&east=74.0&outputFormat=GTiff>
- Licence: Free academic key; underlying datasets under their own open licences (SRTM public domain, Copernicus DEM licence); key may not be embedded in a public app
- What: REST endpoint that returns a GeoTIFF clipped exactly to south/north/west/east for demtype in {SRTMGL1, SRTMGL1_E, SRTMGL3, NASADEM, COP30, COP90, AW3D30, AW3D30_E, EU_DTM, GEDI_L3, GEBCOIceTopo}. Calling it without a key returned HTTP 401, confirming the endpoint and that a free API key (My Account on opentopography.org) is required; 200 calls/day for academic keys, 50 for non-academic; 30 m datasets limited to 450,000 km2 per request. Docs: https://opentopography.org/developers
- Helps: One-call bbox clip of any 30 m DEM for the ETL script instead of downloading full 1-degree tiles; good for reproducible setup scripts.

### Terrain Tiles (Mapzen/Tilezen) on AWS Open Data - elevation-tiles-prod
- Domain: `terrain-flood` · usefulness: **useful** · format: other · access: direct_download
- Page: <https://registry.opendata.aws/terrain-tiles/>
- File: <https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png>
- Licence: Open; attribution per https://github.com/tilezen/joerd/blob/master/docs/attribution.md ('SRTM data courtesy of the U.S. Geological Survey', 'GMTED2010 data courtesy of the U.S. Geological Survey', Mapzen)
- What: Global pre-cut elevation tiles z0-15 built from SRTM/GMTED/ETOPO1 (India coverage comes from SRTM). URL patterns confirmed in Tilezen docs: terrarium/{z}/{x}/{y}.png (RGB-encoded elevation usable as MapLibre raster-dem), normal/{z}/{x}/{y}.png, geotiff/{z}/{x}/{y}.tif (512 px), skadi/N18/N18E073.hgt.gz (1x1 degree). Bucket elevation-tiles-prod (us-east-1) and elevation-tiles-prod-eu; no AWS account required; docs https://github.com/tilezen/joerd/blob/master/docs/use-service.md
- Helps: Drop-in MapLibre terrain/hillshade source (setTerrain with terrarium encoding) without hosting your own DEM tiles; skadi .hgt.gz is a login-free SRTM alternative.

### FABDEM v1-2 (Forest And Buildings removed Copernicus DEM, Univ. of Bristol)
- Domain: `terrain-flood` · usefulness: **useful** · format: geotiff · access: portal_page
- Page: <https://gee-community-catalog.org/projects/fabdem/>
- File: <https://data.bris.ac.uk/data/dataset/s5hqmjcdj8yo2ibzi9b4ew3sn>
- Licence: CC BY-NC-SA 4.0 (non-commercial, share-alike) plus Copernicus DEM attribution notice
- What: 30 m bare-earth DTM derived from Copernicus GLO-30 with buildings and forest removed via ML; 1x1 degree GeoTIFF tiles packed in 10x10 degree zips named by SW-NE corners, so the Pune tile N18E073_FABDEM_V1-2.tif sits in N10E070-N20E080_FABDEM_V1-2.zip. GEE asset projects/sat-io/open-datasets/FABDEM. Citation Hawker et al. 2022 ERL. Bristol repository page (https://data.bris.ac.uk/data/dataset/s5hqmjcdj8yo2ibzi9b4ew3sn) timed out twice during this check but is the official download.
- Helps: Better than a DSM for urban flood/HAND modelling because building heights are removed; fine for a student project (non-commercial).

### Pune Microwatersheds Map (SLUSI / GoI via OpenCity.in)
- Domain: `terrain-flood` · usefulness: **useful** · format: geojson · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-microwatersheds-map>
- File: <https://data.opencity.in/dataset/6126853b-7995-470b-9b05-0c29dc03a481/resource/c80ccf3b-baab-4aa4-baae-be8587e10116/download/pune_micro_watersheds.geojson>
- Licence: Other (Public Domain) per OpenCity; source SLUSI, Government of India
- What: GeoJSON of catchments, watersheds and micro-watersheds for Pune, sourced from the Soil and Land Use Survey of India portal (slusi.da.gov.in); public domain; uploaded Jan 2026; attribute fields not documented on the page.
- Helps: Hydrological units for aggregating DEM-derived flow accumulation and for explaining why a locality floods (same catchment as a known hotspot); can serve as 'area' polygons for comparison in the absence of ward boundaries.

### IMD 0.25-degree daily gridded rainfall over India 1901-2024 (IMD Pune Climate Prediction Group)
- Domain: `terrain-flood` · usefulness: **useful** · format: other · access: portal_page
- Page: <https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html>
- Licence: No explicit licence; IMD disclaimer + citation request (free for research use)
- What: Yearly NetCDF files (135x129 grid, mm/day, 365/366 records) selectable per year 1901-2025; binary .grd variant at /cmpg/Griddata/Rainfall_25_Bin.html with file names ind{YEAR}_rfp25.grd; also fetchable via the imdlib Python package. No registration; citation Pai et al. 2014 (MAUSAM 65(1)). Pune bbox spans roughly 2x2 grid cells, so this gives area-mean rainfall, not intra-city variation.
- Helps: Long daily rainfall record to compute return-period rainfall (e.g. 100 mm/day frequency) and monsoon intensity for the city, feeding a rainfall-exposure factor in the flood score and seasonal messaging.

### Pune Rainfall Data - 5 PMC localities monthly 2016-17 and annual 1980-2019 (PMC Open Data via OpenCity.in)
- Domain: `terrain-flood` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-rainfall-data>
- File: <https://data.opencity.in/dataset/d9cc11fe-f2ac-44b6-974d-d11749a63fba/resource/9d0d5f83-5216-46a9-a9cd-9437838c1b14/download/f973a508-9638-4a9d-9277-5c2f8edf94aa.csv>
- Licence: Other (Public Domain) per OpenCity; source PMC Open Data
- What: Two CSVs from opendata.punecorporation.org: (1) Monthly rainfall Apr-2016 to Mar-2017 for Pashan, Shivajinagar, Lohegaon, Katraj, Hadapsar (confirmed by opening: e.g. Aug-2016 Shivajinagar 351 mm vs Katraj 153 mm); (2) annual max/min temperature and total rainfall for Pune 1980-2019. Public domain.
- Helps: Only station-level (geocodable: Pashan/Shivajinagar/Lohegaon/Katraj/Hadapsar) rainfall available openly; shows the strong west-east rainfall gradient across Pune, usable as a locality rainfall-intensity attribute in area comparison. Annual series supports a 'rainfall trend' note.

### India Flood Inventory-Impacts (IFI-Impacts) 1967-2023 v4 (IIT Delhi HydroSense + IMD, Zenodo)
- Domain: `terrain-flood` · usefulness: **useful** · format: csv · access: direct_download
- Page: <https://zenodo.org/doi/10.5281/zenodo.4742142>
- File: <https://zenodo.org/records/16994648/files/India_Flood_Inventory_v3.csv?download=1>
- Licence: CC BY-NC 4.0
- What: National flood-event database: India_Flood_Inventory_v3.csv (1.8 MB) with UEI, start/end date, duration, main cause, location text, districts, state, lat/lon, severity, area affected, fatalities, injured, displaced, damage, source, LGD codes; plus District_FloodedArea.csv, District_FloodImpact.csv and DFSI.csv (district flood severity index). Opening the CSV confirmed Pune rows for 1969, 1971, 1973, 1975, 1976 and six 2022 events (10-06, 11-07, 13-07, 11-09, 16-09, 17-10-2022); Pune 2019/2024 rows were not checked (file read partially). Published Aug 2025, DOI 10.5281/zenodo.16994648.
- Helps: Historical flood-event frequency and severity index for Pune district to calibrate a city-level flood-hazard weight and show 'N flood events since 1967' context.

### JRC Global Surface Water v1.5 (1984-2024) - tile 70E_20N
- Domain: `terrain-flood` · usefulness: **useful** · format: geotiff · access: direct_download
- Page: <https://global-surface-water.appspot.com/download>
- File: <https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_70E_20Nv1_4_2021.tif>
- Licence: Free of charge without restriction of use (Copernicus/JRC); attribution 'Source: EC JRC/Google', cite Pekel et al. 2016 Nature
- What: Landsat-derived 30 m layers (occurrence, change, seasonality, recurrence, transitions, max extent) in 10x10 degree tiles; the Pune bbox is in tile 70E_20N. Confirmed URL pattern from the page: https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_70E_20Nv1_4_2021.tif (v1.4, 1984-2021); v1.5 (1984-2024) listing is on an S3-compatible endpoint linked from the page; also GEE asset JRC/GSW1_4. Produced under the Copernicus programme, free without restriction, cite Pekel et al. 2016 and credit 'Source: EC JRC/Google'.
- Helps: Water occurrence/recurrence shows where the Mula-Mutha and reservoirs seasonally expand; use as a permanent-water mask for the GFM flood rasters and as a proximity-to-water flood factor.

### PMRDA public GIS Geo-Portal (gis.pmrda.gov.in) - regional plan, metro, ring road, flood Red/Blue lines being onboarded
- Domain: `terrain-flood` · usefulness: **useful** · format: other · access: manual
- Page: <https://gis.pmrda.gov.in/>
- Licence: View-only public information; explicitly not for commercial or legal use; no redistribution terms
- What: Launched 6 Aug 2026 (PMRDA press note https://www.pmrda.gov.in/wp-content/uploads/2026/08/PMRDA-Unveils-GIS-Portal-Planning-Data-Now-Accessible-at-a-Click-1.pdf; Jan 2026 note gives the URL). Landing page shows Home/About/Contact/Validate Document, a Login link and a disclaimer that the Geo Portal information is for public information only and not for commercial or legal use. Layers per press note: PMRDA jurisdiction, approved Regional Plan, TP schemes, village and municipal limits, MSRDC/PMRDA ring roads, Pune Metro corridors, TOD zones, PWD roads, railways; Irrigation Department Red and Blue flood lines, sanctuaries and defence buffer zones 'being onboarded in phases'. No WMS/WFS or download advertised; map viewer not reachable from the landing page without login.
- Helps: Currently the only official online map of the Mula/Mutha/Pavana Blue and Red flood lines (once the layer goes live) - use to visually check or hand-digitise the lines for the floodplain proximity score; cannot be bulk downloaded.

### Pune district administration list of flood-prone localities in Pune city and PCMC (Collector's list, as reported by Punekar News 2021 and 2022)
- Domain: `terrain-flood` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://www.punekarnews.in/?p=110554>
- Licence: News reporting of a government list; use locality names only (facts), credit Pune District Collectorate
- What: News reports (28 Jul 2021 https://www.punekarnews.in/?p=94750 and 12 May 2022) of the District Collector's pre-monsoon list: 25-26 flood-prone urban localities - Hingane Khurd, Vitthalwadi, Pulachi Wadi, Patil Estate, Shantinagar and Indiranagar (Yerawada), Sangamwadi, Loni Kalbhor, Chande, Wakad, Aundh, Dapodi, Sangvi, Baner, Hingangaon, Pimpri, Chinchwad, Kasarwadi, Fugewadi, Pimple Saudagar, Pimple Gurav, Rahatani, Choviswadi, Nirgude - plus 84 flood-prone villages district-wide by taluka (Daund 16, Maval 10, Ambegaon 9, Shirur 9, Mulshi 7, Bhor 3...). Published PDF not located online.
- Helps: Geocodable list of ~23 riverside flood-prone localities inside/near the bbox to flag PG/hostel listings and seed the flood-risk score where the PMC plan tables are image-only.

### Pune Traffic Police waterlogging hotspot lists (26 spots July 2026; 131 spots Sept 2025) and PMC waterlogging counts (250/120/34/201)
- Domain: `terrain-flood` · usefulness: **useful** · format: html_table · access: portal_page
- Page: <https://www.punekarnews.in/?p=238846>
- Licence: News reports; facts (place names) reusable with attribution to Pune Traffic Police / PMC
- What: Pune Traffic Police graded (A+/A/B+/B) list of 26 waterlogging-prone junctions shared with PMC on 3 Jul 2026; named: Shahir Amar Shaikh Chowk, Fatimanagar, Bhairobanala Chowk, Radha Hotel Chowk (Baner), North Main Road (Mundhwa), Tadigutta Chowk, Seven Loves Chowk, road below Ruby Hall Metro station, Gunjan Talkies, Rajaram Bridge. Earlier 131-spot study (30 Sep 2025, https://www.mypunepulse.com/?p=170702) names Warje, Market Yard, Gangadham Chowk, Katraj-Kondhwa Road, Vadgaon Chowk (Sinhagad Rd), Vimannagar Junction, Gunjan Chowk, Khadki underpass, Ganeshkhind Road, Baner Road, Satara Road, Wakadewadi. PMC counts: ~250 identified, 120 prioritised, 34 temporary fixes (16 Jun 2026, https://www.punekarnews.in/monsoon-alert-pmc-races-to-prevent-waterlogging-at-34-critical-locations-in-pune/), 201 spots and Sept-2026 flooded areas Wagholi, Ambethan Temple Rd, Upper Depot, Bibwewadi, Gokul Nagar, Kamthe Nagar, Yewalewadi, VIT College Rd Kondhwa, Kothrud garbage depot, Lagad Mala, Mitramandal Chowk (https://www.thebridgechronicle.com/pune/pune-roads-flooded-drainage-civic-lapses-agn97). Full lists/PDFs not published.
- Helps: ~30 geocodable chronic waterlogging junctions for a 'waterlogging hotspot' point layer; useful for commute-time caveats in monsoon and for the flood score of nearby PGs.

### IMD city weather page - Pune-Shivajinagar (daily 24-h rainfall, 7-day forecast)
- Domain: `terrain-flood` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://city.imd.gov.in/citywx/citywxnew.php?id=43063>
- Licence: IMD public information page; no explicit licence
- What: Official IMD page for station Pune-Shivajinagar (WMO 43063) showing yesterday's max/min temperature with departure from normal, 24-h rainfall to 08:30 IST, humidity, sunrise/sunset and a 7-day forecast table; no history or bulk download on the page; links to a climatological/extreme-weather page. Lohegaon has an equivalent page (different id).
- Helps: Could be polled daily to show 'rain today' / forecast on the map and to trigger a monsoon-mode banner; not a historical dataset.

### IMD Rainfall Information - All-India / state-wise district daily, weekly, cumulative rainfall statistics
- Domain: `terrain-flood` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://mausam.imd.gov.in/imd_latest/contents/rainfallinformation.php>
- Licence: IMD public data; no explicit licence (data.gov.in copy under GODL-India)
- What: IMD portal pages listing district-wise daily/weekly/monthly/cumulative rainfall and departure from normal for every district (Maharashtra -> Pune via State-wise Districts page https://mausam.imd.gov.in/imd_latest/contents/statewisedistricts.php), regional rainfall maps and seasonal normals; HTML tables only, no CSV export; sub-division monthly rainfall 1901-2017 is on data.gov.in (https://data.gov.in/resource/sub-divisional-monthly-rainfall-1901-2017).
- Helps: Pune-district daily rainfall and departure-from-normal for a monsoon dashboard; scrapeable HTML tables.

### Global Flood Database v1 (Cloud to Street / DFO, MODIS 2000-2018) - Earth Engine
- Domain: `terrain-flood` · usefulness: **nice** · format: api · access: api
- Page: <https://developers.google.com/earth-engine/datasets/catalog/GLOBAL_FLOOD_DB_MODIS_EVENTS_V1>
- Licence: CC BY-NC 4.0
- What: 913 mapped flood events 2000-2018 from 12,719 MODIS scenes (250 m water classification, served at 30 m with JRC permanent-water band); bands flooded, duration, clear_views, clear_perc, jrc_perm_water. Only accessible through Google Earth Engine (free registration); no plain download; India events included where DFO recorded them (Pune coverage not verified).
- Helps: Coarse historical flood extents for Pune district events before 2019 if a GEE export step is acceptable; otherwise skip in favour of GFM.

### SANDRP: sanctioned Pune (Mutha) flood-line map images and flood-line history (2024 and 2026 articles)
- Domain: `terrain-flood` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://sandrp.in/2024/08/30/flood-lines-riverfront-development-and-citizen-heroes-story-of-pune-floods/>
- File: <https://sandrp.in/wp-content/uploads/2024/08/image-18.png>
- Licence: Copyright SANDRP (blog); map image originates from Maharashtra WRD; use as reference / for manual georeferencing only
- What: Advocacy articles reproducing the WRD-sanctioned Mutha Blue/Red flood line map section (image https://sandrp.in/wp-content/uploads/2024/08/image-18.png) and the 2011 Mutha flood line map from the Pune DP, with the regulatory history (1989 GR, 2011 Khadakwasla Irrigation Division survey, 2015 MERI circular with Google-Drive link, 2016 DGPS digitised lines sanctioned, Bombay HC 30 June 2025 order for expert committee, CWPRS re-study 2026) and flood dates (25 Jul 2024 Blue line breached at 35,574 cusecs; 2019 Ambil Odha flood at 45,474 cusecs). Companion piece: https://sandrp.in/2026/08/11/corruption-in-flood-lines-regulation-in-pune/ . No GIS files.
- Helps: Reference for georeferencing the Blue/Red lines along the Mutha in QGIS if the PMRDA layer is not live, and for explaining flood-line semantics in the app.

### Sphere India Situation Report 1 - Flood in Maharashtra, 25 July 2024 (Pune section)
- Domain: `terrain-flood` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://www.sphereindia.org.in/sites/default/files/2024-07/SI%20Sitrep-1__Flood%20Situation%20in%20maharashtra%20%2025_-07-2024.pdf>
- File: <https://www.sphereindia.org.in/sites/default/files/2024-07/SI%20Sitrep-1__Flood%20Situation%20in%20maharashtra%20%2025_-07-2024.pdf>
- Licence: Sphere India publication (NGO); factual place names reusable with credit
- What: 3-page NGO sitrep (text-extractable) for the 25 Jul 2024 Pune flood: Khadakwasla release 35,000 -> 45,000 cusecs; waterlogged slums Shivajinagar, Wakdewadi, Ekta Nagar (Sinhagad Rd), Bavdhan, Yerwada; submerged bridges Mundhwa, Shantinagar (Yerwada), Mula bridge Balewadi, Holkar bridge Sangamwadi; flooded societies on Sinhagad Rd, Warje, Baner; Patil Estate evacuated; 500 families from Shantinagar, Bharatnagar, Qatarwadi, Indiranagar relocated; traffic diversions (Khadki underpass, Tip Top Hinjawadi, Manjari Khurd bridges, Vallabhnagar underpass); PMC control room 25506800/25501269.
- Helps: Ground-truth list of localities/bridges flooded on the same date as the GFM Sentinel-1 scene - use to validate the SAR flood raster and label the 2024 event in the app.

### ThinkHazard! report - Pune, Maharashtra (GFDRR)
- Domain: `terrain-flood` · usefulness: **nice** · format: html_table · access: portal_page
- Page: <https://www.thinkhazard.org/en/report/17776-india-maharashtra-pune>
- Licence: GFDRR open (CC BY 4.0 site content)
- What: Qualitative district-level hazard classification: river flood Low, urban flood Low, landslide Medium, extreme heat High, cyclone High, wildfire High, earthquake Medium, water scarcity Medium; PDF summary download; no geodata and no source datasets named.
- Helps: Context text for the 'about the safety score' page; too coarse for scoring.

### Climate Change and Environment Action Plan of Pune District (Vasudha Foundation 2022, mirrored on OpenCity.in)
- Domain: `terrain-flood` · usefulness: **nice** · format: pdf · access: direct_download
- Page: <https://data.opencity.in/dataset/pune-climate-action-plan>
- File: <https://data.opencity.in/dataset/4ab4598e-89fa-4ec2-bcd3-916c081f938f/resource/f1b9b4d3-2285-481d-926a-211fbcb964c3/download/7e19d63d-bb7c-4ea3-9cf7-8d0cfa5b1a73.pdf>
- Licence: Other (Public Domain) per OpenCity; Vasudha Foundation report
- What: District-level plan PDFs (full doc, executive summary 22 pp, annexure, recommendations). Executive summary (text-extracted) has historical and projected rainfall/temperature analysis for Pune district 1951-2018 and recommends hazard mapping and early warning for floods/landslides; no flood-prone locality list or flood map.
- Helps: Citable narrative on rainfall trends for the methodology page only.

### Open-Meteo Historical Weather API (ERA5-Land hourly/daily precipitation for any Pune lat/lon)
- Domain: `terrain-flood` · usefulness: **nice** · format: api · access: api
- Page: <https://open-meteo.com/en/docs/historical-weather-api>
- Licence: Free for non-commercial use (Open-Meteo terms; data CC BY 4.0 attribution to Open-Meteo/ECMWF)
- What: Free REST API returning hourly/daily precipitation_sum, rain, etc. from ERA5 (25 km, 1940-), ERA5-Land (11 km, 1950-) and ECMWF IFS (9 km, 2017-) reanalysis for a point; endpoint https://archive-api.open-meteo.com/v1/archive?latitude=18.52&longitude=73.86&start_date=...&end_date=...&daily=precipitation_sum; no API key for non-commercial use.
- Helps: Quick per-locality long-term rainfall statistics without handling NetCDF; reanalysis is coarse (one cell covers most of the city) so use only as a fallback to IMD gridded data.

## Dead ends (checked, not usable)

- `transit`: Transitland (transit.land): no Pune or PMPML operator/feed. Site search for 'pmpml'/'pune' returns 'No feeds match'; the whole transitland-atlas repo tree (feeds/*.dmfr.json, checked end to end) has only two Indian feeds: hmrl.co.in (Hyderabad Metro) and opendata.iiitd.edu.in (Delhi). REST API needs an API key (401).
- `transit`: Mobility Database: only Indian Maharashtra entries are in-maharashtra-pmpml-gtfs-3137 (listed above), in-maharashtra-mumbai-bus-best-gtfs-3138 and in-maharashtra-msrtc-transit-gtfs-2336 (iqskr.github.io/gtfs/gtfs.zip, bbox 73.53-73.62 E / 17.06-17.10 N = Ratnagiri area only, useless for Pune). No Pune Metro GTFS exists anywhere (croyla's progress log confirms metro work is only for Ahmedabad/Bengaluru).
- `transit`: PMPML GTFS-Realtime: croyla's Pune GTFS-RT pipeline (explorer pmpml-rt.blrtransit.com) is in progress, built on a closed-source fork; the explorer page returned empty content and no feed URL or licence is published. Not usable yet.
- `transit`: Chartr (chartr.in/products/gtfs) claims 'India's first open GTFS' including Pune but provides no download link or licence; its PMPML routes API (prod-pmpml-routesapi.chartr.in, documented in croyla's api-doc.yaml) is undocumented/unlicensed, so use the derived MIT-0 GTFS instead of hitting the API.
- `transit`: PMC open data portal opendata.punecorporation.org: hostname now serves a *.pmc.gov.in TLS certificate (cert mismatch), effectively offline; pmc.gov.in/en/open-data returns an HTTP parse error. The OpenCity mirror is the only surviving copy of the PMC bus-stop KML.
- `transit`: data.gov.in: site search returns HTTP 403 to automated fetch and web search surfaced no Pune transit (PMPML/metro/railway) datasets.
- `transit`: rainbowbrt.in (Rainbow BRTS official site): domain is hijacked, 301-redirects to a spam site (xoilac-tv.cheap). Do not visit. No BRT corridor shapefile/GeoJSON/KML was found anywhere; derive BRT corridors from OSM busway tags or the GTFS shapes of Rainbow routes.
- `transit`: PMPML website: no GTFS, API, open-data, route-map, timetable-by-route or fare-chart pages (site map checked); stop list exists only as embedded HTML without coordinates.
- `transit`: Pune Metro official site: 'Know Your Stations', 'Alignment Maps', 'Train Time Table' and 'Download Map' links point to '#'; fare chart is only AVIF images; no KML/CSV/GTFS. Maha-Metro main site (mahametro.org) links only to punemetrorail.org and tenders.
- `transit`: Wikidata: Pink Line / Line 3 (Hinjewadi) stations have no items with coordinates; a P81-on-line query returned 0 rows. Use OSM construction-tagged nodes/ways for Line 3 geometry.
- `transit`: Maharashtra transport dept tariff-card list hosts only MMRTA (Mumbai) auto/taxi cards (2025 and 1 Sep 2026); no Pune/Pimpri-Chinchwad card is online, and the Pune RTO press note of Sept 2026 is not published as a PDF anywhere found. Use the news-reported Rs 30 / Rs 20 parameters.
- `transit`: PMRDA GIS portal: public root shows no map/layers; ArcGIS REST and GeoServer paths 404; /Map/Index 404. PMRDA Line 3 page has no station list or downloadable alignment.
- `transit`: datameet-pune GitHub org (14 repos): no transit data repos; its 2017 wiki 'GTFS feed creation' / 'Bus routes database' projects never produced data. Vonter's GitHub has Bengaluru feeds only (bmtc-gtfs, bmrcl-gtfs), nothing for Pune.
- `transit`: OpenCity search for other Pune transport datasets: only 'Number of Travellers by Mode of Transport' (CSV counts), 'Vehicle Registrations', 'Footpaths and Roads' (CSV) and 'Road Centerline Map' (KMZ) besides the bus-stops and PMPML annual datasets; no metro, BRT, rickshaw-stand or railway layers.
- `transit`: Not checked because the shared web-search budget ran out: PCMC (Pimpri-Chinchwad) Smart City GIS portal for bus-stop layers, and whether the Pune Rickshaw Panchayat publishes a scanned Sept-2026 fare card. A follow-up message can continue those searches.
- `rental-listings`: data.gov.in: direct fetch returns HTTP 403; searches found no Pune/Maharashtra hostel, PG or rent dataset (only Census 2011 Pune catalog).
- `rental-listings`: Pune Police: no public PG/lodging/boarding register. Only a 'Tenant/Paying Guest Information' submission form on complaints.punepolice.gov.in (DNS unresolvable during check) and the Pune Rural Police tenant-info form; the July-2026 DCP order makes PG operators submit tenant lists to police, but nothing is published.
- `rental-listings`: PMC: no published lodging-house licence or PG/hostel register; only enforcement news (11 PG hostels sealed in Lohegaon, 67 establishments checked, Sept 2026). opendata.punecorporation.org fails TLS (cert is for pmc.gov.in); its datasets are mirrored on data.opencity.in (40 PMC datasets: wards map, slums, revenue map, streetlights, fire stations, sewage) but none cover hostels, lodging, housing or rent.
- `rental-listings`: OpenCity.in (data.opencity.in): 73 Pune datasets, none on hostels/PG/rent; 'PMC Wards Info', 'Pune Slums Data', 'Pune Revenue Map' may help other domains.
- `rental-listings`: Social Justice Dept (sjsa.maharashtra.gov.in): no district hostel list PDF found; socialjustice.gov.in BJRC social-audit page lists only 4 Pune hostels with 3 unnamed; HMAS hostel-admission portal moved to hmasnew.mahait.org and was down (16-19 Oct 2026) - re-check for the hostel master list.
- `rental-listings`: Tribal Development Dept: no Pune hostel list online; news only names a Govt Tribal Boys' Hostel at Manjari Stud Farm and one at Bhosari (Aug 2026 protests).
- `rental-listings`: Sakhi Niwas / Working Women Hostel (WCD) district-wise annexures: eparlib.nic.in, eparlib.sansad.in and rsdebate.nic.in PDFs unreachable (DNS/connection refused); only state totals known (77 functional / 138 sanctioned in Maharashtra). No Pune address list found.
- `rental-listings`: mahafood.gov.in older PDFs Welfare_Institutes_Hostels_29.10.2024.pdf and Welfare_Institutes_Hostel_4_6_24.pdf return 404 (superseded by the 10.10.2025 list above). The 2026 Annexure B is a 76-page image-only scan (needs OCR).
- `rental-listings`: Magicbricks PropIndex / Rent Index: magicbricks.com cannot be fetched by the tool; only press coverage (Pune avg rent Rs 31,439 per 1,000 sq ft in Q1 2025, +12.5%); no locality PDF located.
- `rental-listings`: NoBroker rent reports: only news coverage (H1 2025: Pune rents +7-9%); no PDF or locality table found.
- `rental-listings`: 99acres Insite Pune: no 2025/2026 edition located in search.
- `rental-listings`: Housing.com 'top localities Pune' article (has Baner Rs 37,356 and Hinjewadi Rs 21,264 avg rent): returns HTTP 406 to the fetcher; could not verify. Housing.com IRIS reports are national, no Pune locality table.
- `rental-listings`: Gera Pune Residential Realty Report (Vol 15 Issue 2, Jul 2026): gated behind a subscribe form; covers sales prices/inventory, not rents.
- `rental-listings`: BeyondWalls 'Pune 2025 Trends Report' PDF (12 pp): no rent figures, only price commentary.
- `rental-listings`: Kaggle '10 Million House Rent Data of 40 cities': synthetic data. Kaggle 'House Rent Prices of Metropolitan Cities in India' (saisaathvik) and 'House Rent Prediction Dataset' (iamsouravbanerjee): no Pune. Kaggle 'Pune Property Prices' (2016) and 'India House data' (saipavansaketh): sale prices.
- `rental-listings`: Hugging Face Pune_House_Data.csv (pranit144 space): sale prices in lakhs, locality text only, no coordinates. HF dataset search 'pune': nothing on housing. Zenodo API search: no Pune rental/hostel dataset.
- `rental-listings`: GitHub: repos found are models/apps without data (ParthPanjabi/Pune-House-Rent-Prediction, AyushSid28/PuneRentals, Vaibhavsakure/Pune_Rental_Housing_Market- is a scraper). trivediyash154-source/pune-affordibility-index contains magicbricks_rentals.xlsx (1,779 scraped MagicBricks listings - not legally usable) and pune_rr_rates.csv whose values are mostly marked 'estimated'.
- `rental-listings`: BBBike pre-made city extracts: no Pune extract (only Bombay, NewDelhi). Geofabrik has no India-wide shapefile (zone-level shp/gpkg exist).
- `rental-listings`: MIT-WPU Student Housing Manual PDFs (2025-26 V10, 2026-27 V1/V6) all 404; blog page also 404. VIT hostel PDF host betawp.vit.edu unresolvable; PICT and Bharati Vidyapeeth hostel pages not reached (web-search budget exhausted).
- `rental-listings`: SPPU, COEP, Fergusson: no lists of recognised private PGs/hostels exist on their sites; only on-campus hostel info.
- `rental-listings`: Overture Places taxonomy CSV (overture_categories.csv) not found at expected GitHub paths; 'lodging'/'hotel' confirmed, hostel/student-housing sub-categories unverified. Foursquare OS Places category list likewise unverified.
- `rental-listings`: Web-search quota for this run was exhausted after ~45 queries; remaining unsearched angles: PICT/BVP/MIT hostel addresses, WCD Maharashtra working-women-hostel list, 'Dr. Panjabrao Deshmukh hostel allowance' Pune hostel directory.
- `education-employment`: unipune.ac.in/affiliated_colleges_and_institutions/default.htm and beta.unipune.ac.in/pdf_files/administration/List_of_Affiliated_colleges.pdf (SPPU affiliated-college list) - 404 / host does not resolve; no bulk SPPU list found, only the per-college search at bcud.unipune.ac.in
- `education-employment`: seepz.gov.in/pune-cluster-list-of-sezs - page says 'Coming soon'; use pune-cluster-about and sezindia.gov.in PDFs instead
- `education-employment`: seepz.gov.in/sectorwise-unit-details - covers SEEPZ Mumbai units only, no Pune cluster unit list
- `education-employment`: STPI Pune (pune.stpi.in, stpi.in) - no public list of registered STP/EHTP units for the Pune jurisdiction; only aggregate export figures. The only STPI unit list found (mohali.stpi.in 'List of STP and EHTP Unit 31.03.2022') is for STPI Bengaluru, names only
- `education-employment`: MIDC industrial-areas portal cmsportal.midcindia.org - serves a default ASP.NET template page, no content; midc.maharashtra.gov.in/industrial-areas 404
- `education-employment`: MIDC VacantPlotsDetails / MILAAP (services.midcindia.org, land.midcindia.org home) - allotment portals, plot inventory only behind login; use the ArcGIS REST service instead
- `education-employment`: Directorate of Industries Maharashtra (di.maharashtra.gov.in investors_guide_itpolicy.html, downloads.html, BT.pdf) - connection refused at time of check; the '485 approved private IT parks' list could not be opened
- `education-employment`: India Industrial Land Bank (iis.ncog.gov.in/parks) - connection refused; also login-gated
- `education-employment`: Hinjawadi Industries Association - no website/member roster found in search results
- `education-employment`: AICTE dashboard HTML (facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved) - JS app with no visible download; use the approvedinstituteserver.php JSON endpoint instead. www.aicte.gov.in/education/institutes 404
- `education-employment`: data.gov.in search/catalog pages for 'AICTE' - no bulk approved-institute dataset; only a 2020 parliamentary reply on minority engineering colleges and seat statistics
- `education-employment`: UGC list of colleges with AISHE codes (https://www.ugc.gov.in/pdfnews/5062602_list-of-CollegesAISHE.pdf) - exists per search index (State/District/University/AISHE code/College name) but >10 MB so it could not be opened by fetch; check manually. www.ugc.gov.in/Colleges returns 403. No current state-wise UGC 2(f)/12(B) college list found (only 2009 counts and university-level 12(B) lists)
- `education-employment`: DTE Maharashtra institute search (dte.maharashtra.gov.in/dte-search-institute-e/) just links to approval26/ugpg26 login portals; approval25 institute-data pages render empty without JS; EMIS portals show only a title; no downloadable DTE institute directory
- `education-employment`: NIRF - no consolidated CSV on nirfindia.org or data.gov.in; only HTML rank tables (openable in browser, 403 to WebFetch) and per-institute PDFs. Dataful.in mirrors are commercial, licence unclear
- `education-employment`: opendata.punecorporation.org - TLS certificate mismatch (cert for pmc.gov.in); use the OpenCity mirror
- `education-employment`: Wikidata box query with wikibase:cornerWest/cornerEast returns 0 - must use cornerSouthWest/cornerNorthEast
- `education-employment`: mba2025.mahacet.org - host did not resolve; MBA institute list not verified (fe2025 and ph2025 confirmed)
- `education-employment`: Web search budget for this run was exhausted after ~45 searches; EON Kharadi / SP Infocity tenant lists, PMC ward-wise college lists and NASSCOM member directory were not searched further
- `terrain-flood`: www.punefloodcontrol.com - named in the PMC 2025 plan as WRD's Bhima-basin flood information site, but the domain now shows a parked 'We are working hard to launch our page' placeholder (Blackbox Media); no dam/discharge data.
- `terrain-flood`: Bhuvan thematic 'Flood Hazard' / 'Flood Annual Layers' (https://bhuvan.nrsc.gov.in/wiki/index.php/Thematic_Data) - only visualisation, no per-state list, no WMS URL on the page; only known flood hazard zonation is Assam (1998-2015); nothing for Pune/Maharashtra.
- `terrain-flood`: NDEM / NRSC flood inundation maps - no Pune product for 2019 (Ambil Odha) or 2024; only Kolhapur-Sangli (Jul 2021), Gadchiroli (Aug 2022) PDFs on nrsc.gov.in; Disaster Charter activation 723 (Jul 2021) covers Raigad/Satara/Kolhapur, outside the bbox.
- `terrain-flood`: Pune District Disaster Management Plan (DDMP) PDF - not published: pune.gov.in Disaster Management page (last updated 03.05.2018) lists only helplines; site search for 'flood' returns nothing; no DDMP found on MSDMA/divisional sites (unlike Raigad, Jalna, Mumbai City which post theirs). Flood-prone village list exists only as news (Punekar News 2021/2022).
- `terrain-flood`: Official Mula/Mutha/Pavana Blue-line / Red-line GIS file (KML/shapefile/GeoJSON) - none public anywhere: WRD/Khadakwasla Irrigation Division maps exist only as images in SANDRP posts and NGT affidavit PDFs; PMRDA Geo-Portal is view-only and the flood-line layer is still being onboarded; PMC DP map sheets with flood lines not found on pmc.gov.in; lines are under re-study (Bombay HC 2025 committee, CWPRS 2026) so any digitised version may change.
- `terrain-flood`: maharain.gov.in (Maharashtra circle-wise daily rainfall) - connection refused (TLS), could not be opened.
- `terrain-flood`: mahageoportal.maharashtra.gov.in (MRSAC Maharashtra Geoportal) - connection refused; MRSAC site lists only PDF taluka maps (e.g. Purandhar), no flood hazard layer for Pune.
- `terrain-flood`: hydro.imd.gov.in (IMD Hydromet / Customized Rainfall Information System) - HTTP 404 at root; station-level IMD AWS/ARG downloads for Shivajinagar/Lohegaon not available openly (only the daily city page).
- `terrain-flood`: opendata.punecorporation.org - TLS certificate mismatch (now pmc.gov.in); successor https://opendata.pmc.gov.in/ is a React app whose /datasets and /pmc-reports tables are empty for non-browser fetchers; Open Data Policy page does not state a licence (footer 'All rights reserved'; PMC says it endorses NDSAP). Needs a real browser to list datasets.
- `terrain-flood`: JRC Data Catalogue global river flood hazard maps (https://data.jrc.ec.europa.eu/collection/id-0054 and /dataset/jrc-floods-floodmapgl_rp100y-tif) - WAF returns 'The requested URL was rejected'; not reachable from this environment.
- `terrain-flood`: WRI Aqueduct Floods hazard maps - datasets.wri.org page gives no file URLs; the documented S3 bucket prefix wri-projects/AqueductFloodTool/download/v2/ is empty and index.html returns 404 on both S3 and GCS; would need manual download via aqueduct.wri.org/floods.
- `terrain-flood`: OpenCity.in search 'pune flood' - zero datasets; no flood-prone-spot or relief-centre dataset exists there (73 Pune datasets, none on flood hazard).
- `terrain-flood`: Zenodo / Figshare / GitHub - no Pune-specific urban flood susceptibility or inundation dataset found; Zenodo search page is JS-only; EGU26 abstract on Pune flood resilience index has no data link; Mutha HEC-RAS studies have no public outputs.
- `terrain-flood`: data.bris.ac.uk FABDEM dataset page - ECONNRESET then 60 s timeout on two attempts (metadata confirmed via GEE community catalog instead).
- `terrain-flood`: ckandev.indiadataportal.com IMD station monthly rainfall 1969-2020 CSV - HTTP 403.
- `terrain-flood`: earthdata.nasa.gov NASADEM catalog page and github.com joerd 'blob' pages partially - 403 for the fetcher (CMR API and raw docs used instead).
- `terrain-flood`: www.pmc.gov.in - returns a malformed HTTP header to the fetcher ('Invalid header value char'); use webadmin.pmc.gov.in mirror for the same node/file paths.
- `terrain-flood`: PMC plan PDF pages 12-48 and page 107 are scanned images (CCITT/JPEG), so the '127 potentially affected settlements' list and the flood-control map need OCR; pypdf text extraction works for the rest.
- `terrain-flood`: Pune 2017 Development Plan map sheets (with Blue/Red lines) - no download on pmc.gov.in; only third-party viewers (1acre.in, not open) and an RTI-obtained copy referenced by Moneylife.
- `terrain-flood`: Shared WebSearch budget (200/turn) was exhausted near the end, so a search for earlier-year PMC flood plans and a pmc.gov.in relief-centre page was not completed.
- `safety`: Web search budget for this run was exhausted (200 searches shared across agents) after ~30 queries; remaining checks were done with direct fetches and the built-in browser only.
- `safety`: punepolice.gov.in is a React SPA: WebFetch returns only '<title>Pune City Police' for every page (home, /about-us/divisional-acp, /citizen-corner/citizen-alert-wall, /my-safe-pune). Use the admin.punepolice.gov.in JSON API or a browser. Its /sitemap.xml is broken (27 entries all https://www.example.com/).
- `safety`: https://admin.punepolice.gov.in/api/misc has no police-station list (it returns press releases 'data'/'rol' – 13,778 paginated press-release PDFs with ps_id and dept fields, plus 'bravery' photos); /api/home returns 404. Station list is at /api/ps.
- `safety`: No official police-station jurisdiction boundary polygons exist online: no shapefile/GeoJSON on punepolice.gov.in, mahapolice.gov.in, data.gov.in, OpenCity or DataMeet; only PMRDA/GMDA-type boundary servers for other regions turned up. Jurisdiction is only described textually in per-station RTI PDFs (Citizen Alert Wall) and can be approximated by Voronoi of station points.
- `safety`: No official Pune police chowky list page beyond the chowki1-8 fields in /api/ps?ps=<id>. Third-party directories (indiacustomercare.com: 40 stations + 60 chowkis with phones, no licence; findeasy.in: 31 station addresses, no licence) are unlicensed scrapes – not used.
- `safety`: NCRB official site (ncrb.gov.in → ncrb.mha.gov.in) is JS-driven: crime-in-india.html, crime-in-india-year-wise.html?year=2023 ('No record found') and crime-in-india-table-content.html expose no file URLs. Use the OpenCity public-domain mirror instead.
- `safety`: OpenCity NCRB 'city-wise' PDFs (IPC, IPC+SLL, Crime against women 2021-2023) cover only the 34 cities of 1-2 million and omit Pune; Pune is only in the 19-metro tables inside Vol 1.
- `safety`: mahacid.gov.in 'Crime in Maharashtra' publications page: year selector (2005-2029) renders no documents; /publications/crime-in-maharashtra/2023 → 404; /page/crime-review is a single 2020 weekly robbery/chain-snatching bulletin with no district tables.
- `safety`: PMC open-data portal opendata.punecorporation.org is unreachable (TLS certificate belongs to *.pmc.gov.in, hostname mismatch); pmc.gov.in/en returned a parse error. Use the OpenCity mirrors of PMC datasets.
- `safety`: No pole-level PMC street-light or smart-pole inventory is published anywhere open; only the ward-office-level count table (15 rows). PMC's GIS geotagging of lamp posts is internal.
- `safety`: No open CCTV camera location dataset for Pune Police or PMC (news reports only: ~2,000 PMC cameras, 2,880 new police cameras planned).
- `safety`: Pune District iRAD/eDAR page (https://pune.gov.in/en/i-rad-project/) describes the accident database but publishes no data; iRAD dashboards are restricted to stakeholder departments.
- `safety`: data.gov.in search (https://www.data.gov.in/search?title=pune%20police) → 403; smartcities.data.gov.in/catalogs?query=pune → 404; tn.data.gov.in/resource/traffic-lights-pune is only a 2015 count of traffic signals (no locations).
- `safety`: OpenCity 'Traffic Accidents in India 2016-18' CSV covers Ahmedabad, Bangalore, Chandigarh, Chennai, Indore, Lucknow, Nagpur, Visakhapatnam – no Pune.
- `safety`: Johns Hopkins BIGRS Pune 2025 factsheet (https://publichealth.jhu.edu/sites/default/files/2026-05/v4_2025_0527_BIGRS_PUNE_18_PAGES.pdf) → 403; its content is superseded by the official Pune Police Road Safety Report 2024 anyway.
- `safety`: IUDX catalogue (https://cos.iudx.org.in/iudx/cat/v1/search?property=[tags]&value=[[pune]]) lists 7 Pune resources (Pune Knowledge Cluster / PMC, e.g. covicore), all accessPolicy SECURE; the Safetipin Pune safety-index layer is not visible/open. catalogue.cos.iudx.org.in UI shows no Pune entry in its first pages; api.catalogue.cos.iudx.org.in does not resolve.
- `safety`: Safetipin 8-city report PDF (https://safetyscore.safetipin.com/resources/files/Safety%20Audit%20Report%20of%208%20Cities.pdf) and Safetipin Dec-2019 newsletter exceed the 10 MB fetch limit and were not inspected; Safetipin publishes no raw Pune audit points.
- `safety`: Maharashtra Highway Police 'Black Spot Series-3 (2019-2021)' statewide report could not be located on an official site; only the PMC/PCMC extracts hosted on Google Drive via Parisar were found.
- `safety`: web.archive.org (archived 2011 punepolice.gov.in/jurisdiction.htm with station jurisdiction text) cannot be fetched from this environment.
- `safety`: GitHub / DataMeet searches for a Pune police-station GeoJSON or a geocoded Pune crime/incident dataset returned nothing relevant (only Hyderabad/Telangana and Mumbai police-station maps on OpenCity).
- `safety`: Pune Police 'My Safe Pune' geotagged-image system and the 274-location dark-spot list sent to PMC (2024-25) are not published as data; only news coverage exists (thebridgechronicle, punekarnews, mypunepulse).
- `basemap-roads`: download.bbbike.org/osm/bbbike/Pune/ does not exist (HTTP 404); the only Indian pre-built BBBike city extracts are Bombay and NewDelhi. The Bombay.poly covers lon 72.75–73.16, lat 18.84–19.36, so it does NOT reach Pune. Use extract.bbbike.org for a custom Pune cut instead.
- `basemap-roads`: Geofabrik has no Maharashtra or Pune sub-extract; western-zone.html says 'No sub regions are defined for this region'. Western Zone (211 MB pbf / 481 MB shp.zip) is the smallest Geofabrik file containing Pune.
- `basemap-roads`: OSM has NO admin_level=8 boundary relation for Pune Municipal Corporation or Pimpri-Chinchwad Municipal Corporation (Overpass admin_level 7|8 query in bbox 18.3–18.9 N, 73.5–74.2 E returned only relation 15027480 Pune Metropolitan Region; the name-regex query returned only the district and two subdistricts). Nominatim returns 'Pune' and 'Pimpri-Chinchwad' only as place=city nodes (16174445 and 1600720975). PMC/PCMC polygons must come from a non-OSM source (another domain).
- `basemap-roads`: OSM has zero admin_level 9 or 10 (zone/ward) boundary relations in the Pune bbox (Overpass count = 0 on lz4.overpass-api.de), so PMC ward boundaries are not available from OSM.
- `basemap-roads`: Pune Cantonment exists in OSM only as a place=suburb node (669519639), not a boundary polygon.
- `basemap-roads`: overpass-api.de main server returned HTTP 502 on three attempts during this run; maps.mail.ru timed out (504) on relation queries with admin_level regex; overpass.private.coffee returned 500 on two queries. lz4.overpass-api.de worked. Expect flakiness and keep a mirror list.
- `basemap-roads`: Protomaps build index: https://build.protomaps.com/ and builds.json variants return 404; https://maps.protomaps.com/builds/ is a JS-rendered page with no fetchable listing. Open it in a browser to pick the latest .pmtiles URL.
- `basemap-roads`: Protomaps hosted API (protomaps.com/api) requires an API key (free for non-commercial use, limits not published), so it is not a 'no-key' provider.
- `basemap-roads`: Interline OSM Extracts (app.interline.io/osm_extracts) has no Pune region and its last status note is from 2019; sign-up required. Not recommended.
- `basemap-roads`: osm-boundaries.com requires OSM OAuth login to download and its site terms restrict redistribution; the same polygons are obtainable freely via polygons.openstreetmap.fr or Nominatim lookup, so it is unnecessary.
- `basemap-roads`: FOSSGIS usage-terms page (fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen) is behind Anubis bot protection and could not be fetched; the English summary on routing.openstreetmap.de/about.html (1 req/s, non-commercial) was used instead.
- `basemap-roads`: docs.hotosm.org/export-tool, export.hotosm.org/en/v3/learn and hotosm.org/tools-and-data/export-tool all 404 or render only a JS title; the GitHub README is the only fetchable description.
- `basemap-roads`: tiles.versatiles.org root page is just a logo; the usable endpoints are tiles.json and assets/styles/*/style.json listed above.
- `basemap-roads`: WebSearch budget for this run was exhausted after the first fetch round, so all remaining verification was done with direct WebFetch of known URLs; no additional discovery searches were possible.
- `pmc-open-data`: opendata.punecorporation.org (old PMC portal URL): HTTP→HTTPS 301 then 404, and the TLS cert is for *.pmc.gov.in; it is dead in 2026 and replaced by https://opendata.pmc.gov.in (API https://opendataapi.pmc.gov.in). All OpenCity 'source' links still point at the dead host.
- `pmc-open-data`: https://www.pmc.gov.in/en/open-data → 404. The 2022 ward-map PDFs referenced in the OpenCity 2022 wards KML 'origin' field (http://www.pmc.gov.in/sites/default/files/final_ward_maps/N_F_Ward.pdf) → 404; no PMC-hosted 2025 (41-prabhag) ward-map PDF was located (search budget ran out before trying pmc.gov.in directly).
- `pmc-open-data`: PMC GIS Portal https://gis.pmc.gov.in (IGiS 1.7, SGL): 'City Map' guest access and 'Heritage Map' both sit behind a username/password + CAPTCHA login; GIS Cell page lists functions only; no WMS/WFS/ArcGIS REST endpoints or downloads exposed. Not usable as an open source.
- `pmc-open-data`: olddata.opencity.in: connection fails (curl 000); everything has moved to data.opencity.in.
- `pmc-open-data`: smartcities.data.gov.in: /cities/pune and /catalogsv2?city=Pune both return 0 catalogs ('No Result Found'); OSM wiki page 'Open Geospatial Data from SmartCites in India' has an empty Pune section.
- `pmc-open-data`: punesmartcity.in (PSCDCL): Angular SPA with projects/press PDFs only; no open data, GIS or download section. PUDX/IUDX catalogue: api.catalogue.iudx.io does not resolve (DNS); no Pune catalogue reachable.
- `pmc-open-data`: MRSAC: www.mrsac.gov.in, mrsac.maharashtra.gov.in and mahageoportal.maharashtra.gov.in all time out / refuse connections (curl 000) on 2026-10-18; MRSAC's web-applications page could not be read. Even when up, MRSAC data is supplied to departments on request, not as open downloads.
- `pmc-open-data`: data.gov.in PMC/PMRDA catalog pages: WebFetch gets 403; curl shows the catalog metadata but 'No Result Found' for resources (client-side rendered) – resource lists unverified.
- `pmc-open-data`: Property-tax ZONE polygons: no open spatial dataset anywhere (PMC portal, OpenCity, data.gov.in only have zone-wise/ward-wise collection tables). Closest geometry is the 5-polygon PMZ Zones KML and the Revenue Map KMZ.
- `pmc-open-data`: Water-supply ZONE / DMA polygons (144 zones of the 24x7 project) and ESR locations: not published openly; only WTP list with text 'areas served' (2012) and 15-ward LPCD/hours CSV.
- `pmc-open-data`: Building footprints: nothing from PMC/OpenCity/DataMeet; PMC's GIS property mapping is closed. Use Microsoft/Google Open Buildings (outside this domain).
- `pmc-open-data`: Official flood-prone / waterlogging spot list: not on the PMC portal or OpenCity as data; only news reports (Pune Traffic Police 26 hotspots graded A+/A/B+/B for 2025 monsoon; PMC's ~250/120/34 spot lists) and the PMC 'Regional Disaster Management Plan – Pune City 2014-15' PDF on opendata.pmc.gov.in (dataset 304, not opened). Irrigation Dept red/blue floodline maps: no download found (PMRDA GIS onboarding them; wrd.maharashtra.gov.in not checked – search budget exhausted).
- `pmc-open-data`: Street-light point locations: PMC only publishes ward-wise pole counts; Pune Smart City 'smart street light' project data is not open.
- `pmc-open-data`: Hostels/PG listings: nothing on any of these portals.
- `pmc-open-data`: PMC 'Pune Smart City Proposal' (OpenCity, 2 PDFs ~37 MB) and 'Pune Comprehensive Mobility Plan' / 'Metro DPR' PDFs: documents only, no data layers – skipped.
- `pmc-open-data`: Web search budget for this turn was exhausted after ~45 searches; not re-checked: wrd.maharashtra.gov.in floodline maps, PMC 2025 prabhag map PDFs, IGR Maharashtra ready-reckoner zone maps, Pune Police/Traffic Police open data.
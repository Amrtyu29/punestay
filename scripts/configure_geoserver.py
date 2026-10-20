"""Publishes the PuneStay PostGIS tables through GeoServer's REST API (idempotent).

Creates workspace `punestay`, a PostGIS datastore, and these WMS/WFS layers:
  punestay:pois            every OpenStreetMap service point (category, subcategory, name, tags)
  punestay:services        SQL view of pois with a clean `subcategory` column, for the Nearby Services page
  punestay:listings_public PGs / hostels / flats
  punestay:destinations    colleges and offices
  punestay:safety_reports  crowd-sourced night-safety reports
  punestay:wards           ward polygons (only if loaded)

Usage:
    python scripts/configure_geoserver.py            # uses GEOSERVER_URL / GEOSERVER_USER / GEOSERVER_PASSWORD from .env
"""
import json
import sys

import requests

from common import env

GS = env("GEOSERVER_URL", "http://localhost:8080/geoserver").rstrip("/")
AUTH = (env("GEOSERVER_USER", "admin"), env("GEOSERVER_PASSWORD", "geoserver"))
WS = "punestay"
STORE = "punestay_postgis"
BBOX = {"minx": 73.62, "miny": 18.40, "maxx": 74.05, "maxy": 18.75, "crs": "EPSG:4326"}

SERVICES_SQL = """
SELECT p.id, p.osm_id, p.category, p.name,
       COALESCE(p.tags->>'amenity', p.tags->>'shop', p.tags->>'leisure', p.tags->>'railway',
                p.tags->>'highway', p.tags->>'office', p.tags->>'tourism', p.category) AS subcategory,
       p.tags->>'phone' AS phone, p.tags->>'website' AS website, p.tags->>'opening_hours' AS opening_hours,
       p.tags->>'addr:street' AS street, p.tags->>'addr:suburb' AS suburb,
       p.geom
FROM pois p
WHERE p.category NOT IN ('locality', 'street_lamp')
"""


def rest(method, path, body=None, ctype="application/json", ok=(200, 201)):
    r = requests.request(method, f"{GS}/rest{path}", auth=AUTH, timeout=60,
                         headers={"Content-Type": ctype, "Accept": "application/json"},
                         data=json.dumps(body) if ctype == "application/json" and body is not None else body)
    return r


def ensure_workspace():
    if rest("GET", f"/workspaces/{WS}.json").status_code == 200:
        return
    r = rest("POST", "/workspaces", {"workspace": {"name": WS}})
    print("workspace:", r.status_code)


def ensure_datastore():
    if rest("GET", f"/workspaces/{WS}/datastores/{STORE}.json").status_code == 200:
        return
    body = {"dataStore": {"name": STORE, "connectionParameters": {"entry": [
        {"@key": "dbtype", "$": "postgis"},
        {"@key": "host", "$": env("POSTGRES_HOST", "localhost")},
        {"@key": "port", "$": env("POSTGRES_PORT", "5433")},
        {"@key": "database", "$": env("POSTGRES_DB", "punestay")},
        {"@key": "schema", "$": "public"},
        {"@key": "user", "$": env("POSTGRES_USER", "punestay")},
        {"@key": "passwd", "$": env("POSTGRES_PASSWORD", "punestay")},
        {"@key": "Expose primary keys", "$": "true"},
        {"@key": "validate connections", "$": "true"},
    ]}}}
    r = rest("POST", f"/workspaces/{WS}/datastores", body)
    print("datastore:", r.status_code, r.text[:200] if r.status_code not in (200, 201) else "")


def publish_table(name, title, geom_type="Point"):
    if rest("GET", f"/workspaces/{WS}/datastores/{STORE}/featuretypes/{name}.json").status_code == 200:
        print(f"layer {name}: exists")
        return
    body = {"featureType": {"name": name, "nativeName": name, "title": title, "srs": "EPSG:4326",
                            "nativeBoundingBox": BBOX, "latLonBoundingBox": BBOX, "enabled": True}}
    r = rest("POST", f"/workspaces/{WS}/datastores/{STORE}/featuretypes", body)
    print(f"layer {name}: {r.status_code} {r.text[:200] if r.status_code not in (200, 201) else ''}")


def publish_sql_view(name, title, sql, key="id"):
    if rest("GET", f"/workspaces/{WS}/datastores/{STORE}/featuretypes/{name}.json").status_code == 200:
        print(f"layer {name}: exists")
        return
    body = {"featureType": {
        "name": name, "nativeName": name, "title": title, "srs": "EPSG:4326",
        "nativeBoundingBox": BBOX, "latLonBoundingBox": BBOX, "enabled": True,
        "metadata": {"entry": [{"@key": "JDBC_VIRTUAL_TABLE", "virtualTable": {
            "name": name, "sql": sql.strip(), "escapeSql": False, "keyColumn": key,
            "geometry": {"name": "geom", "type": "Point", "srid": 4326},
        }}]},
    }}
    r = rest("POST", f"/workspaces/{WS}/datastores/{STORE}/featuretypes", body)
    print(f"layer {name}: {r.status_code} {r.text[:200] if r.status_code not in (200, 201) else ''}")


POINT_SLD = """<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer><Name>punestay_point</Name><UserStyle><Title>Small indigo circle</Title>
    <FeatureTypeStyle><Rule>
      <PointSymbolizer><Graphic><Mark><WellKnownName>circle</WellKnownName>
        <Fill><CssParameter name="fill">#0f766e</CssParameter><CssParameter name="fill-opacity">0.75</CssParameter></Fill>
        <Stroke><CssParameter name="stroke">#ffffff</CssParameter><CssParameter name="stroke-width">1</CssParameter></Stroke>
      </Mark><Size>7</Size></Graphic></PointSymbolizer>
    </Rule></FeatureTypeStyle>
  </UserStyle></NamedLayer>
</StyledLayerDescriptor>"""


def ensure_point_style(layers):
    """A small circle instead of GeoServer's default big red squares, applied to the point layers."""
    name = "punestay_point"
    if rest("GET", f"/workspaces/{WS}/styles/{name}.json").status_code != 200:
        # POSTing the SLD body with ?name= creates the style and its file in one go.
        r = requests.post(f"{GS}/rest/workspaces/{WS}/styles", params={"name": name}, auth=AUTH, timeout=60,
                          headers={"Content-Type": "application/vnd.ogc.sld+xml"}, data=POINT_SLD.encode())
        print("style create:", r.status_code, r.text[:200] if r.status_code not in (200, 201) else "")
        if r.status_code not in (200, 201):
            return
    for layer in layers:
        r = rest("PUT", f"/layers/{WS}:{layer}", {"layer": {"defaultStyle": {"name": f"{WS}:{name}"}}})
        print(f"style on {layer}: {r.status_code}")


def main():
    try:
        v = rest("GET", "/about/version.json")
    except requests.RequestException as exc:
        sys.exit(f"GeoServer not reachable at {GS}: {exc}")
    if v.status_code != 200:
        sys.exit(f"GeoServer answered {v.status_code}; check GEOSERVER_USER / GEOSERVER_PASSWORD")
    ensure_workspace()
    ensure_datastore()
    publish_table("pois", "OpenStreetMap service points")
    publish_sql_view("services", "Nearby services (clean subcategory)", SERVICES_SQL)
    publish_table("listings_public", "PGs, hostels and flats")
    publish_table("destinations", "Colleges and offices")
    publish_table("safety_reports", "Night-safety reports")
    publish_table("wards", "Wards", "MultiPolygon")
    ensure_point_style(["pois", "services", "listings_public", "destinations", "safety_reports"])
    # Smoke check: one WFS feature from the services view.
    r = requests.get(f"{GS}/{WS}/ows", params={"service": "WFS", "version": "2.0.0", "request": "GetFeature",
                                               "typeNames": f"{WS}:services", "count": 1, "outputFormat": "application/json"}, timeout=60)
    print("WFS services check:", r.status_code, (r.json().get("numberReturned") if r.ok else r.text[:200]))
    print(f"WMS: {GS}/{WS}/wms?service=WMS&version=1.1.0&request=GetMap&layers={WS}:services&bbox=73.7,18.4,74.0,18.7&width=600&height=600&srs=EPSG:4326&format=image/png")


if __name__ == "__main__":
    main()

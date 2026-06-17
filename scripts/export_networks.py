"""Export walk/slow network edges for analysis map (OSMnx)."""
import json
from pathlib import Path

import osmnx as ox
from shapely.geometry import mapping

ox.settings.use_cache = True
ox.settings.log_console = True

CENTER = (31.249, 121.459)
DIST = 3000
OUT = Path(__file__).resolve().parents[1] / "data"


def _json_val(val):
    if val is None:
        return None
    if isinstance(val, float) and (val != val or val == float("inf") or val == float("-inf")):
        return None
    if isinstance(val, list):
        return val[0] if val else None
    return val


def edges_to_geojson(G, path: Path):
    gdf = ox.graph_to_gdfs(G, nodes=False, edges=True)
    gdf = gdf.reset_index()
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    features = []
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        hw = row.get("highway")
        if isinstance(hw, list):
            hw = hw[0] if hw else None
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "highway": _json_val(hw),
                    "name": _json_val(row.get("name")),
                    "length": float(row.get("length") or 0),
                },
                "geometry": mapping(geom),
            }
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, allow_nan=False),
        encoding="utf-8",
    )
    print(f"{path}: {len(features)} edges")


def main():
    print("walk network...")
    G_walk = ox.graph_from_point(CENTER, dist=DIST, network_type="walk", simplify=True)
    edges_to_geojson(G_walk, OUT / "walk" / "network.geojson")

    print("slow network...")
    G_slow = ox.graph_from_point(CENTER, dist=DIST, network_type="bike", simplify=True)
    edges_to_geojson(G_slow, OUT / "slow" / "network.geojson")

    # express: copy existing classified expressways
    src = OUT / "networks" / "express.geojson"
    dst = OUT / "express" / "network.geojson"
    if src.exists():
        dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        n = len(json.loads(dst.read_text(encoding="utf-8")).get("features", []))
        print(f"{dst}: {n} edges (from express.geojson)")


if __name__ == "__main__":
    main()

import json

base_src = r"F:\Aworks\2026studio\shanghaistation\urban-stitching\output"
base_dst = r"F:\Aworks\2026studio\shanghaistation\期末出图\html\data"

for mode in ["walk", "slow", "express"]:
    src = f"{base_src}\\{mode}\\data\\boundary_index_points.geojson"
    dst = f"{base_dst}\\{mode}\\boundary_points.geojson"
    with open(src, encoding="utf-8") as f:
        d = json.load(f)
    d["features"] = [ft for ft in d["features"] if ft["properties"]["point_kind"] != "outer_ring"]
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(d, f, separators=(",", ":"))
    print(f"{mode}: {len(d['features'])} pts -> {dst}")

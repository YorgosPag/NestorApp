#!/usr/bin/env python3
import json
import math

# Load the DXF scene data
filepath = r'C:\Users\user\.claude\projects\C--Nestor-Pagonis\b02dbd27-4b6c-448a-80ca-96b4185b6c68\tool-results\mcp-firestore-storage_read_file-1780829119813.txt'

with open(filepath, encoding='utf-8') as f:
    wrapper = json.load(f)

content_str = wrapper.get('content', '{}')
if isinstance(content_str, str):
    scene = json.loads(content_str)
else:
    scene = content_str

entities = scene.get('entities', [])
lines = [e for e in entities if e.get('type') == 'line']

print(f'Total lines: {len(lines)}')
print(f'Scene units: {scene.get("units", "unknown")}')
print()

def dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def get_line_endpoints(line):
    s = line.get('startPoint') or line.get('start') or {}
    e = line.get('endPoint') or line.get('end') or {}
    sx = s.get('x', s.get(0, 0))
    sy = s.get('y', s.get(1, 0))
    ex = e.get('x', e.get(0, 0))
    ey = e.get('y', e.get(1, 0))
    length = dist((sx, sy), (ex, ey))
    return length, (sx, sy), (ex, ey)

# Build line data
line_data = []
for idx, line in enumerate(lines):
    length, start, end = get_line_endpoints(line)
    line_data.append({
        'idx': idx,
        'id': line.get('id', '?'),
        'len': length,
        'start': start,
        'end': end,
        'layer': line.get('layerId', '?'),
        'color': line.get('color', '?')
    })

# Find rectangles by examining all 4-line combinations
EPSILON = 0.001
rectangles = []
checked = 0

print("Analyzing 4-line combinations for rectangles...")
total_combos = len(line_data) * (len(line_data)-1) * (len(line_data)-2) * (len(line_data)-3) // 24
print(f"Total possible combinations: ~{total_combos}")
print()

# Simpler approach: collect all endpoints and find which 4 lines form a rectangle
for i in range(len(line_data)):
    for j in range(i+1, len(line_data)):
        for k in range(j+1, len(line_data)):
            for m in range(k+1, len(line_data)):
                lines_group = [line_data[i], line_data[j], line_data[k], line_data[m]]
                checked += 1

                # Get all points with rounding
                points = {}
                for ln in lines_group:
                    key_start = (round(ln['start'][0], 3), round(ln['start'][1], 3))
                    key_end = (round(ln['end'][0], 3), round(ln['end'][1], 3))
                    if key_start not in points:
                        points[key_start] = []
                    if key_end not in points:
                        points[key_end] = []
                    points[key_start].append((ln['idx'], 'start'))
                    points[key_end].append((ln['idx'], 'end'))

                # Check if we have exactly 4 unique points
                if len(points) == 4:
                    pts_list = list(points.keys())

                    # Calculate all pairwise distances
                    dists = []
                    for p1 in pts_list:
                        for p2 in pts_list:
                            if p1 < p2:
                                d = dist(p1, p2)
                                dists.append((d, p1, p2))

                    dists.sort()

                    # For a rectangle: 4 sides (2 pairs equal) + 2 diagonals (equal)
                    # Or: 4 equal sides (square) + 2 equal diagonals
                    if len(dists) == 6:
                        side1 = dists[0][0]
                        side2 = dists[1][0]
                        side3 = dists[2][0]
                        side4 = dists[3][0]
                        diag1 = dists[4][0]
                        diag2 = dists[5][0]

                        # Check for rectangle pattern
                        sides_sorted = sorted([side1, side2, side3, side4])
                        is_rectangle = (
                            abs(sides_sorted[0] - sides_sorted[1]) < EPSILON and
                            abs(sides_sorted[2] - sides_sorted[3]) < EPSILON and
                            abs(diag1 - diag2) < EPSILON
                        )

                        if is_rectangle:
                            width = min(sides_sorted[0], sides_sorted[2])
                            height = max(sides_sorted[0], sides_sorted[2])

                            # Filter: only rectangles with reasonable size
                            if width > 0.02 and height > 0.02:
                                rectangles.append({
                                    'line_indices': [l['idx'] for l in lines_group],
                                    'width': width,
                                    'height': height,
                                    'area': width * height,
                                    'points': sorted(pts_list),
                                    'diagonal': diag1,
                                    'colors': [l['color'] for l in lines_group],
                                    'layers': [l['layer'] for l in lines_group]
                                })

print(f"Checked {checked} combinations")
print(f"Found {len(rectangles)} rectangles")
print()

if rectangles:
    # Sort by area
    rectangles.sort(key=lambda r: r['area'], reverse=True)

    print("TOP 20 RECTANGLES BY AREA:")
    print("-" * 70)
    for i, rect in enumerate(rectangles[:20]):
        print(f"Rect {i+1}:")
        print(f"  Size: {rect['width']:.4f} x {rect['height']:.4f}")
        print(f"  Area: {rect['area']:.6f}")
        print(f"  Diagonal: {rect['diagonal']:.4f}")
        print(f"  Line indices: {rect['line_indices']}")
        print()
else:
    print("No rectangles found")

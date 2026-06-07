#!/usr/bin/env python3
import json
import math
from collections import defaultdict

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

def dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def norm_point(p, precision=4):
    return (round(p[0], precision), round(p[1], precision))

# Parse all lines
line_info = {}
for idx, line in enumerate(lines):
    s = line.get('startPoint') or line.get('start') or {}
    e = line.get('endPoint') or line.get('end') or {}
    sx, sy = s.get('x', s.get(0, 0)), s.get('y', s.get(1, 0))
    ex, ey = e.get('x', e.get(0, 0)), e.get('y', e.get(1, 0))

    start_norm = norm_point((sx, sy))
    end_norm = norm_point((ex, ey))
    length = dist((sx, sy), (ex, ey))

    line_info[idx] = {
        'idx': idx,
        'start': start_norm,
        'end': end_norm,
        'length': length,
        'color': line.get('color', ''),
        'layer': line.get('layerId', '')
    }

print(f"Total lines: {len(line_info)}")

# Build connectivity graph
endpoint_to_lines = defaultdict(set)
for idx, info in line_info.items():
    endpoint_to_lines[info['start']].add(idx)
    endpoint_to_lines[info['end']].add(idx)

# Find all groups of 4 lines forming rectangles by exhaustive search
# But be smarter: for each line pair sharing an endpoint, check if they can close into a rectangle

rectangles = set()

# For each pair of lines that share an endpoint
for shared_point, lines_at_point in endpoint_to_lines.items():
    if len(lines_at_point) < 2:
        continue

    lines_list = list(lines_at_point)
    for i in range(len(lines_list)):
        for j in range(i+1, len(lines_list)):
            line1_idx = lines_list[i]
            line2_idx = lines_list[j]

            line1 = line_info[line1_idx]
            line2 = line_info[line2_idx]

            if line1['length'] < 0.01 or line2['length'] < 0.01:
                continue

            # Get other endpoints
            if line1['start'] == shared_point:
                p1_other = line1['end']
            else:
                p1_other = line1['start']

            if line2['start'] == shared_point:
                p2_other = line2['end']
            else:
                p2_other = line2['start']

            # Now we need to find the opposite corner of the rectangle
            # The rectangle would be: shared_point -> p1_other -> opposite -> p2_other -> shared_point

            # Try to find lines at p1_other and p2_other
            for line3_idx in endpoint_to_lines[p1_other]:
                if line3_idx == line1_idx or line3_idx == line2_idx:
                    continue

                line3 = line_info[line3_idx]
                if line3['length'] < 0.01:
                    continue

                # Get the other endpoint of line3
                if line3['start'] == p1_other:
                    p3_other = line3['end']
                else:
                    p3_other = line3['start']

                # Try to find lines at p2_other
                for line4_idx in endpoint_to_lines[p2_other]:
                    if line4_idx in [line1_idx, line2_idx, line3_idx]:
                        continue

                    line4 = line_info[line4_idx]
                    if line4['length'] < 0.01:
                        continue

                    # Get the other endpoint of line4
                    if line4['start'] == p2_other:
                        p4_other = line4['end']
                    else:
                        p4_other = line4['start']

                    # Check if p3_other == p4_other (they meet at the opposite corner)
                    if p3_other == p4_other:
                        # Now check if this forms a valid rectangle
                        sides = [line1['length'], line2['length'], line3['length'], line4['length']]
                        sides_sorted = sorted(sides)

                        # Check for rectangle pattern: 2 pairs of equal sides
                        tol = 0.001
                        if (abs(sides_sorted[0] - sides_sorted[1]) < tol and
                            abs(sides_sorted[2] - sides_sorted[3]) < tol):

                            rect_lines = tuple(sorted([line1_idx, line2_idx, line3_idx, line4_idx]))
                            if rect_lines not in rectangles:
                                width = min(sides_sorted[0], sides_sorted[2])
                                height = max(sides_sorted[0], sides_sorted[2])
                                rectangles.add((width, height, rect_lines))

print(f"Found {len(rectangles)} unique rectangles")
print()

if rectangles:
    rect_list = sorted(list(rectangles), key=lambda x: x[0]*x[1], reverse=True)

    print("ALL RECTANGLES (sorted by area):")
    print("-" * 90)
    for i, (width, height, lines) in enumerate(rect_list[:50]):
        area = width * height
        print(f"{i+1:3d}. {width:8.4f} x {height:8.4f} = {area:11.6f}  |  Lines: {lines}")

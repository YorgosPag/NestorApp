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
line_info = []
for idx, line in enumerate(lines):
    s = line.get('startPoint') or line.get('start') or {}
    e = line.get('endPoint') or line.get('end') or {}
    sx, sy = s.get('x', s.get(0, 0)), s.get('y', s.get(1, 0))
    ex, ey = e.get('x', e.get(0, 0)), e.get('y', e.get(1, 0))

    start_norm = norm_point((sx, sy))
    end_norm = norm_point((ex, ey))
    length = dist((sx, sy), (ex, ey))

    line_info.append({
        'idx': idx,
        'start': start_norm,
        'end': end_norm,
        'length': length,
        'color': line.get('color', ''),
        'layer': line.get('layerId', '')
    })

print(f"Total lines: {len(line_info)}")

# Build graph of endpoints -> lines
endpoint_to_lines = defaultdict(list)
for info in line_info:
    endpoint_to_lines[info['start']].append(info['idx'])
    endpoint_to_lines[info['end']].append(info['idx'])

# Find potential rectangles
# A rectangle has 4 corners, each with 2 lines meeting at right angles
# Strategy: for each line, find other lines that could form a rectangle with it

rectangles_found = []
checked = 0

for i, line1 in enumerate(line_info):
    if line1['length'] < 0.01:
        continue

    # Get the two endpoints of line1
    for corner1 in [line1['start'], line1['end']]:
        # Find other lines at this corner
        other_lines_at_corner1 = [idx for idx in endpoint_to_lines[corner1] if idx != line1['idx']]

        for line2_idx in other_lines_at_corner1:
            line2 = line_info[line2_idx]
            if line2['length'] < 0.01:
                continue

            # line2 must share only one endpoint with line1
            shared = 0
            if line1['start'] == line2['start'] or line1['start'] == line2['end']:
                shared += 1
            if line1['end'] == line2['start'] or line1['end'] == line2['end']:
                shared += 1

            if shared != 1:
                continue

            # Now we have line1 and line2 meeting at corner1
            # Find the other endpoint of line2
            if line2['start'] == corner1:
                corner2 = line2['end']
            else:
                corner2 = line2['start']

            # Find lines at corner2
            other_lines_at_corner2 = [idx for idx in endpoint_to_lines[corner2] if idx != line2['idx']]

            for line3_idx in other_lines_at_corner2:
                line3 = line_info[line3_idx]
                if line3['length'] < 0.01:
                    continue

                # line3 must share corner2 with line2 but not with line1
                if line1['idx'] in [line3['idx']]:
                    continue

                # Get the free endpoint of line3
                if line3['start'] == corner2:
                    corner3 = line3['end']
                else:
                    corner3 = line3['start']

                # Now find the 4th line from corner1 to corner3
                lines_at_corner3 = endpoint_to_lines[corner3]
                lines_at_corner1 = endpoint_to_lines[corner1]

                # Find common line
                common = set(lines_at_corner3) & set(lines_at_corner1)
                for line4_idx in common:
                    line4 = line_info[line4_idx]
                    if line4['length'] < 0.01:
                        continue

                    # Verify this is a rectangle
                    sides = [line1['length'], line2['length'], line3['length'], line4['length']]
                    sides_sorted = sorted(sides)

                    # Rectangle should have two pairs of equal sides
                    if (abs(sides_sorted[0] - sides_sorted[1]) < 0.01 and
                        abs(sides_sorted[2] - sides_sorted[3]) < 0.01):

                        rect_key = tuple(sorted([line1['idx'], line2['idx'], line3['idx'], line4['idx']]))

                        # Check for duplicates
                        is_dup = False
                        for existing in rectangles_found:
                            if existing['key'] == rect_key:
                                is_dup = True
                                break

                        if not is_dup:
                            width = min(sides_sorted[0], sides_sorted[2])
                            height = max(sides_sorted[0], sides_sorted[2])
                            rectangles_found.append({
                                'key': rect_key,
                                'lines': list(rect_key),
                                'width': width,
                                'height': height,
                                'area': width * height,
                                'corners': sorted([corner1, corner2, corner3])
                            })

print(f"Found {len(rectangles_found)} rectangles")
print()

if rectangles_found:
    rectangles_found.sort(key=lambda r: r['area'], reverse=True)

    print("ALL RECTANGLES (sorted by area):")
    print("-" * 80)
    for i, rect in enumerate(rectangles_found[:30]):
        w = rect['width']
        h = rect['height']
        print(f"{i+1:2d}. {w:7.4f} x {h:7.4f} = {rect['area']:9.6f}  |  Lines: {rect['lines']}")

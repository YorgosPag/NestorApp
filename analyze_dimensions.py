#!/usr/bin/env python3
import json
import math
from collections import defaultdict, Counter

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
        'start': start_norm,
        'end': end_norm,
        'length': length,
    }

# Build connectivity
endpoint_to_lines = defaultdict(set)
for idx, info in line_info.items():
    endpoint_to_lines[info['start']].add(idx)
    endpoint_to_lines[info['end']].add(idx)

# Find rectangles
rectangles = set()

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

            if line1['start'] == shared_point:
                p1_other = line1['end']
            else:
                p1_other = line1['start']

            if line2['start'] == shared_point:
                p2_other = line2['end']
            else:
                p2_other = line2['start']

            for line3_idx in endpoint_to_lines[p1_other]:
                if line3_idx == line1_idx or line3_idx == line2_idx:
                    continue

                line3 = line_info[line3_idx]
                if line3['length'] < 0.01:
                    continue

                if line3['start'] == p1_other:
                    p3_other = line3['end']
                else:
                    p3_other = line3['start']

                for line4_idx in endpoint_to_lines[p2_other]:
                    if line4_idx in [line1_idx, line2_idx, line3_idx]:
                        continue

                    line4 = line_info[line4_idx]
                    if line4['length'] < 0.01:
                        continue

                    if line4['start'] == p2_other:
                        p4_other = line4['end']
                    else:
                        p4_other = line4['start']

                    if p3_other == p4_other:
                        sides = [line1['length'], line2['length'], line3['length'], line4['length']]
                        sides_sorted = sorted(sides)

                        tol = 0.001
                        if (abs(sides_sorted[0] - sides_sorted[1]) < tol and
                            abs(sides_sorted[2] - sides_sorted[3]) < tol):

                            rect_lines = tuple(sorted([line1_idx, line2_idx, line3_idx, line4_idx]))
                            if rect_lines not in rectangles:
                                width = min(sides_sorted[0], sides_sorted[2])
                                height = max(sides_sorted[0], sides_sorted[2])
                                rectangles.add((round(width, 4), round(height, 4), rect_lines))

print(f"Found {len(rectangles)} unique rectangles\n")

# Analyze dimension distribution
rect_list = sorted(list(rectangles), key=lambda x: x[0]*x[1], reverse=True)

# Extract unique dimension pairs
dimension_pairs = {}
for width, height, lines in rect_list:
    key = (width, height)
    if key not in dimension_pairs:
        dimension_pairs[key] = []
    dimension_pairs[key].append(lines)

print(f"Unique dimension pairs: {len(dimension_pairs)}\n")
print("DIMENSION PAIRS (sorted by frequency, then by area):")
print("-" * 80)

dimension_freq = [(pair, len(rects), pair[0]*pair[1]) for pair, rects in dimension_pairs.items()]
dimension_freq.sort(key=lambda x: (-x[1], -x[2]))

for (width, height), count, area in dimension_freq[:40]:
    print(f"  {width:8.4f} x {height:8.4f}  |  {count:3d} rect(s)  |  Area: {area:9.6f}")

print("\n\nSUMMARY STATISTICS:")
print("-" * 80)
print(f"Total rectangles found: {len(rect_list)}")
print(f"Unique dimension pairs: {len(dimension_pairs)}")
print(f"Most common dimension: {dimension_freq[0][0]} ({dimension_freq[0][1]} occurrences)")
print(f"Largest rectangle: {rect_list[0][0]} x {rect_list[0][1]} (area={rect_list[0][0]*rect_list[0][1]:.6f})")
print(f"Smallest rectangle: {rect_list[-1][0]} x {rect_list[-1][1]} (area={rect_list[-1][0]*rect_list[-1][1]:.6f})")

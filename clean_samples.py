import re
import os

with open("raw_samples.txt", "r") as f:
    lines = f.readlines()

clean_lines = []
for line in lines:
    # remove "Unnamed: XXX"
    line = re.sub(r'Unnamed:\s*\d+', '', line)
    # remove consecutive empty pipes " | | " -> " | "
    line = re.sub(r'(\|\s*){2,}', '| ', line)
    # remove trailing pipes
    line = line.rstrip(' | \n')
    clean_lines.append(line)

# Path to artifact directory
artifact_path = "/Users/abhi/.gemini/antigravity/brain/24203986-4f82-44a6-afb2-04f712def816/artifacts/raw_batch_samples.md"
with open(artifact_path, "w") as f:
    f.write("---\nsummary: Raw Data Extraction for User Review\nartifact_type: other\n---\n")
    f.write("# Raw Batch Samples\n\n```text\n")
    f.write("\n".join(clean_lines))
    f.write("\n```\n")

print("Created artifact.")

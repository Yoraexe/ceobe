---
name: forensic-disk
description: "Disk forensics skill. File carving, file system analysis, deleted file recovery, timeline reconstruction, and artifact extraction from disk images. Tools: autopsy, foremost, bulk_extractor, binwalk, exiftool. Triggers: 'disk forensics', 'file carving', 'deleted files', 'disk image', 'autopsy', 'partition analysis'."
---

# Disk Forensics

You are performing **disk forensics** on a storage image. Evidence integrity preserved throughout. All work is non-destructive — original image is never modified.

## Hard Preconditions

1. Disk image path confirmed and readable
2. Integrity hash recorded BEFORE analysis
3. Mount read-only if mounting
4. Output directory writable

```bash
# Hash before touching
sha256sum disk.img > disk.img.sha256
# Mount read-only (Linux)
sudo mount -o ro,loop disk.img /mnt/evidence
```

## Tool Priority Order

1. **autopsy** — full disk analysis (GUI + CLI)
2. **foremost** — file carving (deleted files)
3. **bulk_extractor** — feature extraction (emails, URLs, cards)
4. **binwalk** — firmware/binary analysis, embedded file extraction
5. **exiftool** — metadata from recovered files
6. **tshark / wireshark** — if PCAP files found on disk

## Workflow

### Phase 1: Partition & File System Analysis

```bash
# Identify partitions
fdisk -l disk.img
mmls disk.img   # from sleuthkit

# Get file system info
fsstat -o <offset> disk.img   # sleuthkit
file disk.img
```

### Phase 2: File Carving (Recover Deleted Files)

```bash
# Foremost — carve by file signatures
foremost -i disk.img -o ./carved/ -t jpg,pdf,doc,zip,exe,png

# Scalpel — faster alternative
scalpel disk.img -o ./scalpel-output/
```

### Phase 3: Bulk Feature Extraction

```bash
# Extract emails, URLs, credit cards, phone numbers
bulk_extractor -o ./bulk-output/ -j 4 disk.img

# Key output files in bulk-output/:
# email.txt, url.txt, ccn.txt, telephone.txt, domain.txt
cat bulk-output/url.txt | sort -u > interesting-urls.txt
cat bulk-output/email.txt | sort -u > email-addresses.txt
```

### Phase 4: File System Timeline

```bash
# Build filesystem timeline (sleuthkit)
fls -r -m / disk.img > timeline-fls.txt
mactime -b timeline-fls.txt > timeline.txt

# Filter for suspicious time window
grep "2026-06-1[0-9]" timeline.txt > suspicious-window.txt
```

### Phase 5: Artifact-Specific Analysis

```bash
# Windows artifacts
find /mnt/evidence -name "*.evt" -o -name "*.evtx" | while read f; do
  evtxtract "$f" > "${f%.evtx}-extracted.txt"
done

# Prefetch files (execution evidence)
find /mnt/evidence/Windows/Prefetch -name "*.pf" -exec strings {} \; | grep -i ".exe" > prefetch.txt

# Registry hives
find /mnt/evidence -name "NTUSER.DAT" -o -name "SAM" -o -name "SYSTEM" > registry-hives.txt

# Browser artifacts
find /mnt/evidence -path "*/Chrome/User Data/Default/History" -exec cp {} ./chrome-history.db \;
sqlite3 chrome-history.db "SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 100;"
```

### Phase 6: Metadata Extraction

```bash
# Extract metadata from all recovered files
exiftool -r -json ./carved/ > carved-metadata.json

# Find files with suspicious creation dates
cat carved-metadata.json | jq '.[] | select(.CreateDate < "2020:01:01")' > suspicious-dates.json

# Find GPS coordinates in images
cat carved-metadata.json | jq '.[] | select(.GPSLatitude != null) | {file: .SourceFile, lat: .GPSLatitude, lon: .GPSLongitude}'
```

### Phase 7: Binary/Firmware Analysis (if applicable)

```bash
# Analyze binary blobs or firmware images
binwalk -e -M disk.img

# Look for embedded file systems
binwalk --signature disk.img | grep -i "file system\|squash\|cramfs\|jffs2"
```

## Output Structure

```
engagement/forensics/disk/
├── disk.img.sha256             # Integrity hash
├── carved/                     # Foremost recovered files
├── bulk-output/                # Bulk extractor features
│   ├── email.txt
│   ├── url.txt
│   └── ccn.txt
├── timeline.txt                # Filesystem timeline
├── suspicious-window.txt       # Filtered timeline
├── prefetch.txt                # Execution evidence
├── chrome-history.db           # Browser artifacts
└── carved-metadata.json        # File metadata
```

## Next Phase

Pass findings to:
- `forensic-network` — correlate URLs from bulk_extractor with PCAP
- `forensic-report` — compile full IR report

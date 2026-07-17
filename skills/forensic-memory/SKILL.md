---
name: forensic-memory
description: "Memory forensics skill. Acquires and analyzes RAM dumps using volatility3. Extracts process lists, network connections, injected code, encryption keys, and malware artifacts. Triggers: 'memory forensics', 'ram analysis', 'volatility', 'memory dump', 'memdump', 'process injection'."
---

# Memory Forensics

You are performing **memory forensics** on a captured RAM image. Evidence integrity must be preserved throughout. All actions are logged for chain-of-custody.

## Hard Preconditions

Before starting:
1. Memory image path is confirmed and readable
2. Image integrity hash (MD5/SHA256) recorded BEFORE analysis
3. Working directory is writable for output
4. Tools verified via availability check

```bash
# Hash the image before touching it
sha256sum memory.dmp > memory.dmp.sha256
md5sum memory.dmp >> memory.dmp.sha256
```

## Tool Priority Order

1. **volatility3** — primary analysis framework (plugins cover all phases)

## Tool Availability Check

```bash
which vol3 || which volatility3   # Linux/macOS
where.exe vol3                     # Windows
python3 -c "import volatility3"   # Python module check
```

If missing:
```
[TOOL MISSING] volatility3: pip install volatility3
```

## Workflow

### Phase 1: Image Identification

Identify OS, architecture, and memory layout:

```bash
# Identify OS profile
vol3 -f memory.dmp windows.info   # Windows
vol3 -f memory.dmp linux.banners  # Linux
vol3 -f memory.dmp mac.tasks      # macOS
```

### Phase 2: Process Analysis

```bash
# List all processes (including hidden)
vol3 -f memory.dmp windows.pstree   > analysis/pstree.txt
vol3 -f memory.dmp windows.pslist   > analysis/pslist.txt
vol3 -f memory.dmp windows.psscan   > analysis/psscan.txt   # finds hidden processes

# Compare pslist vs psscan to detect hidden processes
diff <(grep -oP '(?<=PID\s)\d+' analysis/pslist.txt | sort -n) \
     <(grep -oP '(?<=PID\s)\d+' analysis/psscan.txt | sort -n)
```

### Phase 3: Network Artifacts

```bash
# Active and closed network connections
vol3 -f memory.dmp windows.netstat  > analysis/netstat.txt
vol3 -f memory.dmp windows.netscan  > analysis/netscan.txt
```

### Phase 4: Code Injection Detection

```bash
# Find injected code (DLL injection, process hollowing)
vol3 -f memory.dmp windows.malfind   > analysis/malfind.txt

# Check DLL load order (detect hijacking)
vol3 -f memory.dmp windows.dlllist --pid <suspicious_pid> > analysis/dlllist.txt

# Dump suspicious process memory
vol3 -f memory.dmp windows.memmap --pid <pid> --dump > analysis/memdump/
```

### Phase 5: Artifact Extraction

```bash
# Registry hives (credentials, persistence)
vol3 -f memory.dmp windows.registry.hivelist > analysis/hives.txt

# Cached credentials
vol3 -f memory.dmp windows.hashdump > analysis/hashes.txt

# Clipboard contents
vol3 -f memory.dmp windows.clipboard > analysis/clipboard.txt

# Browser history (if in memory)
vol3 -f memory.dmp windows.ie_history > analysis/ie-history.txt

# Commandline history
vol3 -f memory.dmp windows.cmdline > analysis/cmdline.txt
```

### Phase 6: File System Artifacts

```bash
# Files cached in memory
vol3 -f memory.dmp windows.filescan > analysis/filescan.txt

# Dump specific files from memory
vol3 -f memory.dmp windows.dumpfiles --physaddr <addr> > analysis/dumpfiles/

# MFT (Master File Table) entries
vol3 -f memory.dmp windows.mftscan > analysis/mft.txt
```

## Output Structure

```
engagement/forensics/memory/
├── memory.dmp.sha256           # Integrity hash (record before any analysis)
├── analysis/
│   ├── pstree.txt              # Process tree
│   ├── psscan.txt              # Hidden process scan
│   ├── netstat.txt             # Network connections
│   ├── malfind.txt             # Injected code regions
│   ├── hashes.txt              # Cached credentials
│   ├── cmdline.txt             # Command line history
│   └── filescan.txt            # File cache
├── memdump/                    # Dumped process memory
└── dumpfiles/                  # Extracted files
```

## Chain of Custody

At every step, log:
- Analyst action
- Tool and command executed
- Timestamp
- Hash of any extracted artifact

```
[2026-06-20 14:32:01] Acquired memory.dmp SHA256: abc123...
[2026-06-20 14:33:15] Ran windows.pstree — 127 processes identified
[2026-06-20 14:34:02] Ran windows.malfind — 3 suspicious regions found in PID 4812
```

## Next Phase

After memory analysis, pass findings to:
- `forensic-disk` — correlate with disk artifacts
- `forensic-network` — correlate with PCAP captures
- `forensic-report` — compile findings into IR report

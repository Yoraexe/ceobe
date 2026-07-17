---
name: re-static
description: "Static reverse engineering skill. Disassembly, decompilation, string extraction, and binary analysis without execution. Tools: ghidra, radare2, cutter, strings, binwalk, objdump. Triggers: 'static analysis', 'reverse engineer', 'disassemble', 'decompile', 'binary analysis', 'strings', 'crackme', 'keygen'."
---

# Static Reverse Engineering

You are performing **static binary analysis** — inspecting a binary without executing it. Goal: understand program logic, find vulnerabilities, identify hardcoded secrets, and reconstruct algorithms.

## Tool Priority Order

1. **ghidra** — decompilation to pseudo-C, primary analysis
2. **radare2** — disassembly, scripting via r2pipe
3. **cutter** — radare2 GUI for visual analysis
4. **binwalk** — embedded file detection, entropy analysis
5. **strings** — quick string extraction
6. **objdump** — sections, imports, exports, disassembly (pre-installed)
7. **readelf** — ELF structure analysis (pre-installed)

## Tool Availability Check

```bash
which ghidra ghidraRun
which r2
strings --version
objdump --version
readelf --version
```

## Workflow

### Phase 1: Initial Triage

```bash
# Identify file type and architecture
file target_binary
strings target_binary | head -100

# ELF information (Linux)
readelf -h target_binary              # ELF header
readelf -S target_binary              # Sections
readelf -d target_binary | grep NEED  # Library dependencies

# PE information (Windows)
objdump -x target_binary | head -50   # PE headers
```

### Phase 2: String Extraction

```bash
# Extract all printable strings
strings -a -n 8 target_binary > strings-all.txt

# Filter for interesting patterns
grep -iE "(password|passwd|secret|key|token|flag|admin|root|auth)" strings-all.txt > strings-interesting.txt
grep -E "(https?://|ftp://)" strings-all.txt > strings-urls.txt
grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" strings-all.txt > strings-ips.txt

# Unicode strings
strings -e l -n 8 target_binary > strings-unicode.txt  # 16-bit little-endian
```

### Phase 3: Imports / Exports Analysis

```bash
# Dynamic imports (what libraries/functions are called)
objdump -d -M intel target_binary | grep "call"  | sort | uniq -c | sort -rn > call-targets.txt
readelf -s target_binary | grep -i "FUNC" > function-table.txt

# For PE files (Windows)
objdump -x target_binary | grep "DLL Name" > dll-imports.txt
```

### Phase 4: Entropy Analysis (Packing/Encryption Detection)

```bash
# High entropy sections = packed/encrypted
binwalk -E target_binary   # entropy graph

# If packed: look for UPX, MPRESS, custom packer
strings target_binary | grep -i "upx\|mpress\|packed\|protect"
binwalk --signature target_binary | grep -i "compress\|encrypt\|pack"
```

### Phase 5: Disassembly with Radare2

```bash
# Open and auto-analyze
r2 -A -q target_binary

# Key commands (inside r2):
# afl        — list all functions
# pdf @main  — disassemble main
# iz         — list strings in binary
# ii         — list imports
# is         — list symbols
# axt @sym.strcmp  — find all callers of strcmp

# Scripted analysis
r2 -A -q -c "afl; pdf @main; iz" target_binary > r2-analysis.txt

# Export call graph
r2 -A -q -c "agcj" target_binary > callgraph.json
```

### Phase 6: Decompilation with Ghidra (Headless)

```bash
# Headless analysis
ghidraRun support/analyzeHeadless \
  /tmp/ghidra-project MyProject \
  -import target_binary \
  -analysisTimeoutPerFile 180 \
  -postScript PrintAST.java \
  -log /tmp/ghidra.log

# For CTF — common Ghidra workflow:
# 1. Import binary → Auto-analyze (A key or Analysis > Auto Analyze)
# 2. Functions list → find main or suspicious names
# 3. Decompiler window → pseudo-C output
# 4. Right-click interesting variables → Rename
# 5. Patch instructions: right-click → Patch Instruction
```

### Phase 7: Anti-Analysis Detection

```bash
# Check for anti-debug tricks
strings target_binary | grep -iE "(IsDebuggerPresent|CheckRemoteDebuggerPresent|NtQueryInformationProcess|ptrace|PTRACE_TRACEME)"

# Check for VM detection
strings target_binary | grep -iE "(vmware|virtualbox|vbox|virtual|sandbox|cuckoo|analysis)"

# Check for timing checks
strings target_binary | grep -iE "(rdtsc|GetTickCount|timeGetTime|QueryPerformance)"
```

## Output Structure

```
engagement/re/static/
├── strings-all.txt             # All strings
├── strings-interesting.txt     # Filtered credentials/flags
├── strings-urls.txt            # URLs found in binary
├── r2-analysis.txt             # Radare2 function list + disassembly
├── callgraph.json              # Function call graph
├── entropy-analysis.txt        # Packing/encryption indicators
└── ghidra-project/             # Ghidra project (if used)
```

## Next Phase

After static analysis, move to `re-dynamic` for runtime behavior confirmation.

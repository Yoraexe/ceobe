---
name: ctf-reverse-tools
description: "CTF reverse engineering tools. GDB/pwndbg, Radare2/Cutter, Ghidra, Binary Ninja, dogbolt.org multi-decompiler, Unicorn emulation, FLIRT signatures, angr symbolic execution. Triggers: 'reverse engineering tools', 'ghidra', 'radare2', 'gdb pwndbg', 'decompiler', 'binary analysis', 'ctf re tools', 'disassembler', 'angr', 'unicorn emulation', 'binary ninja'."
---

# CTF — Reverse Engineering Tools

GDB/pwndbg, Radare2, Ghidra, Binary Ninja, Unicorn, angr, dogbolt.org.

## Install

```bash
# GDB + pwndbg:
apt-get install -y gdb gdb-multiarch
pip install pwndbg --break-system-packages
# OR: git clone https://github.com/pwndbg/pwndbg && cd pwndbg && ./setup.sh

# Radare2:
apt-get install -y radare2
# OR: bash -c "$(curl -fsSL https://raw.githubusercontent.com/radareorg/radare2/master/sys/install.sh)"

# Ghidra (offline decompiler):
# Download from: https://ghidra-sre.org/
# java -jar ghidra_*/ghidraRun

# Python tools:
pip install unicorn capstone angr pwntools --break-system-packages
```

---

## Phase 1: GDB / pwndbg Workflow

```bash
BINARY="./challenge"
gdb -q "$BINARY"

# pwndbg commands:
(gdb) start          # run to main
(gdb) context        # show registers, stack, code, backtrace
(gdb) nextcall       # step to next call
(gdb) plt            # list PLT entries
(gdb) got            # list GOT entries
(gdb) heap           # heap info (pwndbg)
(gdb) vis_heap_chunks  # visualize heap

# Breakpoints:
(gdb) break main
(gdb) break *0x401234    # address breakpoint
(gdb) break strcmp       # libc function

# Examine memory:
(gdb) x/20gx $rsp        # 20 qwords from RSP
(gdb) x/s $rdi           # string at RDI
(gdb) x/10i $rip         # 10 instructions from RIP

# Registers:
(gdb) info registers
(gdb) p $rax
(gdb) set $rax = 0       # modify register

# Dump memory region:
(gdb) dump binary memory dump.bin 0x400000 0x401000
```

---

## Phase 2: Radare2 / Cutter

```bash
BINARY="./challenge"

# Analysis:
r2 -A "$BINARY"   # auto-analyze

# Basic commands:
# aa           - analyze all
# afl          - list all functions
# pdf @main    - disassemble main
# axt @sym     - find xrefs to symbol
# iz           - list strings in data section
# iS           - list sections
# ij           - JSON output of binary info
# /x deadbeef  - search for hex pattern
# /c jmp       - search for instruction

# Rename functions:
# afn better_name @ func_addr

# Graph view:
# VV @ main    - visual graph mode
# (arrows to navigate, tab to switch)

# Write to file (patch binary):
# oo+          - open in write mode
# w NOP @ addr - write NOP at address

# Scripting:
python3 << 'EOF'
import r2pipe

r2 = r2pipe.open("./challenge")
r2.cmd("aa")
print(r2.cmdj("afl"))   # function list as JSON
print(r2.cmd("pdf @main"))
r2.quit()
EOF
```

---

## Phase 3: Ghidra (Static Decompiler)

```bash
# Start Ghidra:
./ghidra_*/support/analyzeHeadless /tmp/ghidra_proj MyProject \
  -import ./challenge -postScript PrintAST.java

# Ghidra script (Python via Jython):
# Window → Script Manager → New

# Quick decompile to stdout:
./ghidra_*/support/analyzeHeadless /tmp/proj MyProj \
  -import ./challenge \
  -postScript ./decompile_all.py 2>/dev/null

# decompile_all.py:
# from ghidra.app.decompiler import DecompInterface
# decomp = DecompInterface()
# decomp.openProgram(currentProgram)
# for f in currentProgram.getFunctionManager().getFunctions(True):
#     results = decomp.decompileFunction(f, 60, monitor)
#     print(results.getDecompiledFunction().getC())
```

---

## Phase 4: dogbolt.org (Online Multi-Decompiler)

```bash
# Upload binary to https://dogbolt.org
# Compare output from: Hex-Rays IDA, Ghidra, BinaryNinja, RetDec, Reko

# When Ghidra shows confusing output, compare with BinaryNinja or RetDec
# Different decompilers recover different variable names and types

# API for automation:
curl -s -X POST "https://dogbolt.org/api/binaries/" \
  -F "file=@./challenge" | jq .id

curl -s "https://dogbolt.org/api/binaries/$ID/decompilations/" | jq .
```

---

## Phase 5: Unicorn Emulation

```python
from unicorn import *
from unicorn.x86_const import *
from capstone import *

CODE_ADDR = 0x400000
STACK_ADDR = 0x7fff0000
STACK_SIZE = 0x10000
CODE_SIZE = 0x10000

# Load shellcode or function bytes:
code = open("shellcode.bin", "rb").read()

mu = Uc(UC_ARCH_X86, UC_MODE_64)
mu.mem_map(CODE_ADDR, CODE_SIZE)
mu.mem_map(STACK_ADDR - STACK_SIZE, STACK_SIZE)

mu.mem_write(CODE_ADDR, code)
mu.reg_write(UC_X86_REG_RSP, STACK_ADDR)
mu.reg_write(UC_X86_REG_RIP, CODE_ADDR)

# Trace instructions:
def hook_code(mu, addr, size, user_data):
    code = mu.mem_read(addr, size)
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    for insn in md.disasm(bytes(code), addr):
        print(f"0x{insn.address:x}: {insn.mnemonic} {insn.op_str}")

mu.hook_add(UC_HOOK_CODE, hook_code)

# Emulate:
try:
    mu.emu_start(CODE_ADDR, CODE_ADDR + len(code))
except UcError as e:
    print(f"Error: {e}")

# Read result:
result = mu.reg_read(UC_X86_REG_RAX)
print(f"RAX = {result:#x}")
```

---

## Phase 6: angr Symbolic Execution

```python
import angr

proj = angr.Project("./challenge", load_options={'auto_load_libs': False})

# Find path to "win" condition:
state = proj.factory.entry_state()
simgr = proj.factory.simulation_manager(state)

WIN_ADDR = 0x401234    # address to reach
AVOID_ADDR = 0x401500  # address to avoid (bad output)

simgr.explore(find=WIN_ADDR, avoid=[AVOID_ADDR])

if simgr.found:
    found = simgr.found[0]
    stdin = found.posix.stdin.concretize()
    print("Input to reach target:", stdin)
else:
    print("No solution found")

# For string input:
state = proj.factory.entry_state(
    stdin=angr.SimFile('/dev/stdin', content=angr.SimBytes(size=20))
)
```

---

## Phase 7: FLIRT Signature Matching

```bash
# Identify stripped library functions via FLIRT signatures

# In IDA Pro: View → Open Subviews → Signatures → + → apply sig

# For Ghidra — use FIRST (online) or FunctionID:
# https://github.com/NWMonster/ApplySig  (IDA to Ghidra sig converter)

# Radare2 with FLIRT:
r2 -A ./challenge
# zfs ~/.radare2/sigkits/vc++.sig   # apply signature

# signsrch — database of known algorithms:
signsrch -e ./challenge
```

---

## Output

Save to `.omop/engagement/ctf/reverse/`:
- `decompiled.c` — Ghidra/BinaryNinja decompilation
- `disasm.txt` — disassembly listing
- `solution.py` — angr/unicorn solution script
- `flag.txt` — extracted flag

## Next Phase

→ `ctf-reverse-patterns` for specific RE attack patterns
→ `ctf-pwn-basics` if binary exploitation needed

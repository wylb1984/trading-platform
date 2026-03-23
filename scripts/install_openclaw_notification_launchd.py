from __future__ import annotations

import plistlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAUNCH_AGENTS = Path.home() / "Library" / "LaunchAgents"


def build_plist(label: str, scope: str, hour: int, minute: int) -> dict:
    script = ROOT / "scripts" / "dispatch-openclaw-notify.sh"
    log_dir = ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    return {
        "Label": label,
        "ProgramArguments": ["/bin/zsh", str(script), scope],
        "WorkingDirectory": str(ROOT),
        "RunAtLoad": False,
        "StartCalendarInterval": [
            {"Weekday": 1, "Hour": hour, "Minute": minute},
            {"Weekday": 2, "Hour": hour, "Minute": minute},
            {"Weekday": 3, "Hour": hour, "Minute": minute},
            {"Weekday": 4, "Hour": hour, "Minute": minute},
            {"Weekday": 5, "Hour": hour, "Minute": minute},
        ],
        "StandardOutPath": str(log_dir / f"{label}.out.log"),
        "StandardErrorPath": str(log_dir / f"{label}.err.log"),
    }


def write_agent(label: str, scope: str, hour: int, minute: int) -> Path:
    LAUNCH_AGENTS.mkdir(parents=True, exist_ok=True)
    target = LAUNCH_AGENTS / f"{label}.plist"
    with target.open("wb") as f:
        plistlib.dump(build_plist(label, scope, hour, minute), f)
    return target


def main() -> None:
    hkcn = write_agent("ai.trading-platform.notify.hkcn", "HKCN", 17, 10)
    us = write_agent("ai.trading-platform.notify.us", "US", 6, 10)
    print(hkcn)
    print(us)


if __name__ == "__main__":
    main()

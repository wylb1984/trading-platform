from __future__ import annotations

import plistlib
from pathlib import Path
import stat


ROOT = Path(__file__).resolve().parents[1]
LAUNCH_AGENTS = Path.home() / "Library" / "LaunchAgents"
RUNTIME_DIR = Path.home() / ".trading-platform-runtime"


def ensure_wrapper(scope: str) -> Path:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    wrapper = RUNTIME_DIR / f"dispatch-openclaw-notify-{scope.lower()}.sh"
    source_script = ROOT / "scripts" / "dispatch-openclaw-notify.sh"
    wrapper.write_text(
        "\n".join(
            [
                "#!/bin/zsh",
                "set -euo pipefail",
                f'cd "{ROOT}"',
                f'exec /bin/zsh "{source_script}" "{scope}"',
                "",
            ]
        ),
        encoding="utf-8",
    )
    wrapper.chmod(wrapper.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return wrapper


def build_plist(label: str, scope: str, hour: int, minute: int) -> dict:
    script = ensure_wrapper(scope)
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

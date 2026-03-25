from __future__ import annotations

import plistlib
from pathlib import Path
import stat


ROOT = Path(__file__).resolve().parents[1]
LAUNCH_AGENTS = Path.home() / "Library" / "LaunchAgents"
RUNTIME_DIR = Path.home() / ".trading-platform-runtime"
LABEL = "ai.trading-platform.app"


def ensure_wrapper() -> Path:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    wrapper = RUNTIME_DIR / "run-trading-platform-app.sh"
    log_dir = ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    wrapper.write_text(
        "\n".join(
            [
                "#!/bin/zsh",
                "set -euo pipefail",
                f'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"',
                f'cd "{ROOT}"',
                'exec /opt/homebrew/bin/npm run dev:lan',
                "",
            ]
        ),
        encoding="utf-8",
    )
    wrapper.chmod(wrapper.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return wrapper


def build_plist() -> dict:
    wrapper = ensure_wrapper()
    log_dir = ROOT / "data" / "logs"
    return {
        "Label": LABEL,
        "ProgramArguments": ["/bin/zsh", str(wrapper)],
        "WorkingDirectory": str(ROOT),
        "RunAtLoad": True,
        "KeepAlive": True,
        "StandardOutPath": str(log_dir / f"{LABEL}.out.log"),
        "StandardErrorPath": str(log_dir / f"{LABEL}.err.log"),
        "EnvironmentVariables": {
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        },
    }


def main() -> None:
    LAUNCH_AGENTS.mkdir(parents=True, exist_ok=True)
    target = LAUNCH_AGENTS / f"{LABEL}.plist"
    with target.open("wb") as handle:
        plistlib.dump(build_plist(), handle)
    print(target)


if __name__ == "__main__":
    main()

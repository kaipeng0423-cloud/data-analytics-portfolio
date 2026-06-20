"""在 Git 传输网络不稳定时，通过 GitHub Contents API 发布当前仓库。"""

from __future__ import annotations

import base64
import subprocess
from pathlib import Path
from urllib.parse import quote

import requests


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "kaipeng0423-cloud/data-analytics-portfolio"
GH = r"D:\Apps\GitHubCLI\gh.exe"


def token() -> str:
    """从已登录 GitHub CLI 安全读取令牌。"""
    return subprocess.check_output([GH, "auth", "token"], text=True).strip()


def files() -> list[Path]:
    """列出需要发布的文件，并把工作流放到最后。"""
    result = [
        path
        for path in ROOT.rglob("*")
        if path.is_file() and ".git" not in path.parts and "__pycache__" not in path.parts
    ]
    return sorted(result, key=lambda path: (".github" in path.parts, path.as_posix()))


def main() -> None:
    """逐文件创建或更新 GitHub 内容。"""
    headers = {
        "Authorization": f"Bearer {token()}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    for path in files():
        relative = path.relative_to(ROOT).as_posix()
        endpoint = f"https://api.github.com/repos/{REPOSITORY}/contents/{quote(relative, safe='/')}"
        existing = requests.get(endpoint, headers=headers, timeout=60)
        sha = existing.json().get("sha") if existing.status_code == 200 else None
        body = {
            "message": f"Publish {relative}",
            "content": base64.b64encode(path.read_bytes()).decode("ascii"),
            "branch": "main",
        }
        if sha:
            body["sha"] = sha
        response = requests.put(endpoint, headers=headers, json=body, timeout=180)
        response.raise_for_status()
        print(f"Uploaded {relative}")


if __name__ == "__main__":
    main()

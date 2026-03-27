from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


ROOT_DIR = Path(__file__).resolve().parent
JOB_DIR = ROOT_DIR / ".chatgpt-jobs"


def _job_path(job_id: str) -> Path:
    return JOB_DIR / f"{job_id}.json"


def _write_job_state(job_id: str, state: dict[str, str]) -> None:
    JOB_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = _job_path(f"{job_id}.tmp")
    final_path = _job_path(job_id)
    temp_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(final_path)


def _call_chatgpt(text: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 OPENAI_API_KEY，无法调用 ChatGPT 接口。")

    #base_url = "https://ai.t8star.cn/v1/chat/completions"
    base_url = "https://api.deepseek.com/chat/completions"
    #model_name = "gpt-5.4"
    model_name = "deepseek-chat"

    api_url = os.getenv("OPENAI_API_BASE", base_url).strip()
    model = os.getenv("OPENAI_MODEL", model_name).strip()
    system_prompt = os.getenv(
        "OPENAI_SYSTEM_PROMPT",
        "你是一个简洁、准确的中文助手。",
    ).strip()

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        "temperature": 0.7,
    }

    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            response_text = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"调用 ChatGPT 接口失败：HTTP {error.code} {error.reason}\n{error_body}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"调用 ChatGPT 接口失败：{error.reason}") from error

    try:
        response_json = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"调用 ChatGPT 接口后返回了非 JSON 内容：\n{response_text}") from error

    choices = response_json.get("choices") or []
    if not choices:
        raise RuntimeError(f"调用 ChatGPT 接口成功，但没有返回内容：\n{response_text}")

    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    raise RuntimeError(f"调用 ChatGPT 接口成功，但内容为空：\n{response_text}")


def _launch_worker(job_id: str, text: str) -> None:
    creation_flags = 0
    for flag_name in ("DETACHED_PROCESS", "CREATE_NEW_PROCESS_GROUP", "CREATE_NO_WINDOW"):
        creation_flags |= getattr(subprocess, flag_name, 0)

    worker_command = [sys.executable, "-X", "utf8", str(Path(__file__).resolve()), "--worker", job_id]
    worker_process = subprocess.Popen(
        worker_command,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=str(ROOT_DIR),
        env={
            **os.environ,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUTF8": "1",
        },
        creationflags=creation_flags,
        text=False,
    )
    if worker_process.stdin is not None:
        worker_process.stdin.write(text.encode("utf-8"))
        worker_process.stdin.close()


def run(text: str) -> str:
    job_id = uuid.uuid4().hex
    _write_job_state(job_id, {"status": "pending", "result": ""})

    try:
        _launch_worker(job_id, text)
    except Exception as error:
        _write_job_state(job_id, {"status": "error", "result": "", "error": str(error)})

    return job_id


def _worker_main(job_id: str) -> None:
    try:
        text = sys.stdin.read()
        result = _call_chatgpt(text)
        _write_job_state(job_id, {"status": "done", "result": result})
    except Exception as error:
        _write_job_state(job_id, {"status": "error", "result": "", "error": str(error)})


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--worker":
        _worker_main(sys.argv[2])
    else:
        input_text = sys.stdin.read()
        sys.stdout.write(run(input_text))
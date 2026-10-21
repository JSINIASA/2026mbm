# Efron's Dice

Flask 기반의 주사위와 슬롯 머신 확률 체험 웹사이트입니다.

## 로컬 실행

```powershell
python -m pip install -r requirements.txt
python app.py
```

브라우저에서 `http://127.0.0.1:5000`을 엽니다.

## GitHub 연결

GitHub CLI(`gh`)로 빈 저장소를 만들고 `origin`에 푸시합니다.

`.github/workflows/ci.yml`은 `main` 브랜치 푸시와 Pull Request마다 Flask 앱 컴파일을 확인합니다.

## 웹 배포

이 프로젝트는 서버가 필요한 Flask 앱이라 GitHub Pages 대신 Render나 Railway 같은 Python 웹 서비스에 GitHub 저장소를 연결해 배포합니다. `Procfile`이 웹 서버 실행 명령을 제공합니다.

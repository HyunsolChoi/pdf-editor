# PDF Editor

브라우저에서 PDF를 업로드하고 직접 수정(텍스트/이미지/SVG 추가, 위치·크기 조정)한 뒤
다시 PDF로 내보내는 정적 웹 앱입니다. GitHub Pages 배포를 염두에 두고 만들어졌습니다.

## 기술 스택

- **React + Vite (TypeScript)** — UI 및 빌드 도구
- **pdf.js** (`pdfjs-dist`) — 업로드한 PDF 페이지를 캔버스에 렌더링
- **fabric.js** — 렌더링된 페이지 위에서 텍스트/이미지/SVG 객체를 드래그·리사이즈·편집
- **pdf-lib** — 편집 결과를 새 PDF 파일로 내보내기

## 동작 방식

1. 업로드한 PDF의 각 페이지를 pdf.js로 캔버스에 그려 배경 이미지로 사용합니다.
2. 그 위에 fabric.js 캔버스를 겹쳐, 텍스트 박스/이미지/SVG를 자유롭게 추가·이동·크기 조절할 수 있습니다.
3. "PDF로 내보내기"를 누르면 각 페이지(배경 + 편집 내용)를 PNG로 합성한 뒤,
   pdf-lib으로 원본과 동일한 크기의 새 PDF를 생성해 다운로드합니다.

> 참고: 기존 PDF의 텍스트는 이미지로 합쳐져 내보내지므로, "기존 텍스트 수정"은
> 흰 사각형 등으로 가린 뒤 새 텍스트를 덮어쓰는 방식으로 처리합니다.

## 개발

```bash
npm install
npm run dev      # 개발 서버 실행
npm run build    # 정적 파일 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
```

## GitHub Pages 배포

`vite.config.ts`의 `base: './'` 설정으로 상대 경로 빌드가 되어 있어,
`dist/` 폴더 내용을 그대로 GitHub Pages(또는 `gh-pages` 브랜치)에 올리면 동작합니다.

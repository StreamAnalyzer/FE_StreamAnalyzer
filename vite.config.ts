import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,   // 원하는 포트
    host: true,   // 외부에서 접근 가능하게
    strictPort: true // 5174가 사용 중이면 에러 발생 (자동 변경 안됨)
  }
})

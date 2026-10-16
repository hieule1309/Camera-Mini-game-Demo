# Camera Mini-game Demo (React + TypeScript + PixiJS + Vision AI)

Dự án demo mini-game tương tác thực tế ảo tăng cường (AR) kết hợp camera feed, đồ họa Canvas/WebGL hiệu năng cao bằng **PixiJS v8**, nhận diện đối tượng bằng **MediaPipe / Motion Tracking**, tối ưu hóa mượt mà trên điện thoại di động và xử lý mạng/ngoại tuyến linh hoạt.

---

## 🎯 Bảng Checklist & Chi tiết Hiện thực

### 1. [x] Hiển thị camera feed và xử lý cấp quyền camera
- **Truy cập Camera**: Triển khai trong [`src/hooks/useCamera.ts`](file:///home/hieult/Camera%20Mini-game%20Demo/src/hooks/useCamera.ts) với `navigator.mediaDevices.getUserMedia`.
- **Quản lý Trạng thái Quyền**: Xử lý đầy đủ các trạng thái `checking`, `granted`, `denied`, `unavailable`, `prompt`.
- **Giao diện Hướng dẫn & Cấp lại quyền**: Component [`src/components/CameraView.tsx`](file:///home/hieult/Camera%20Mini-game%20Demo/src/components/CameraView.tsx) hiển thị hướng dẫn khi bị từ chối hoặc chưa cấp quyền, kèm nút kích hoạt lại.
- **Lật / Đổi Camera**: Hỗ trợ chuyển đổi tức thì giữa Camera Trước (`facingMode: 'user'`) và Camera Sau (`facingMode: 'environment'`), tự động lật gương (mirrored) cho camera trước.
- **Bật/Tắt Đèn Flash (Torch)**: Tự động phát hiện capability của track camera và cung cấp nút bật/tắt đèn pin trên các thiết bị di động hỗ trợ.

---

### 2. [x] Dùng PixiJS vẽ nhân vật, mục tiêu và hiệu ứng trên Canvas/WebGL
- **Engine PixiJS v8**: Khởi tạo WebGL/WebGPU thông qua [`src/game/GameEngine.ts`](file:///home/hieult/Camera%20Mini-game%20Demo/src/game/GameEngine.ts).
- **Nhân vật Người chơi (Player Catcher / Reticle)**:
  - Thiết kế Sci-Fi Reticle với 2 lớp: Vòng hào quang năng lượng (`playerAura`) xoay ngược chiều và tâm điều khiển (`playerGraphics`) với hiệu ứng thở nhịp nhàng.
  - Tự động đổi màu hào quang (Xanh Cyan khi chạm Touch, Tím Neon khi điều khiển qua AI Vision).
- **Mục tiêu (Targets & Collectibles)**:
  - *Energy Orb (Xanh lam)*: Bay lượn dao động hình sin, tích điểm cơ bản.
  - *Golden Star (Vàng kim)*: Mục tiêu thưởng hiếm, cộng 300 điểm và tăng combo.
  - *Hazard Shard (Đỏ)*: Mục tiêu thử thách phản xạ, trừ điểm và ngắt chuỗi combo.
- **Hệ thống Hiệu ứng & Hạt (Particle System)**:
  - Vụ nổ hạt phát sáng (particle burst) tỏa đều theo góc ngẫu nhiên, giảm dần kích thước và alpha khi va chạm.
  - Sóng xung kích (Shockwave ring) mở rộng tức thì từ tâm va chạm.
  - Rung màn hình (Screen shake) với cường độ tự giảm dần (decay).
  - Điểm số bay (Floating Score text: `+100`, `+300 COMBO x2!`) với hiệu ứng scale và mờ dần.
- **Tối ưu Layering**: Canvas PixiJS được render với `backgroundAlpha: 0` xếp chồng trực tiếp lên `<video>`, tránh việc phải upload video texture 60 FPS lên GPU mỗi frame gây nóng máy và tụt pin trên điện thoại.

---

### 3. [x] Xử lý touch, pointer, drag và thao tác bị gián đoạn
- **Pointer Events Chuẩn mực**: Hỗ trợ đồng thời chuột và cảm ứng đa điểm (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`).
- **Khóa & Giải phóng Pointer Capture**: Sử dụng `setPointerCapture` / `releasePointerCapture` theo đúng `pointerId` chính để thao tác kéo mượt mà, không bị trượt khi vuốt nhanh ra ngoài mép màn hình.
- **Xử lý Thao tác Bị gián đoạn**:
  - `document.visibilitychange`: Tự động nhận diện khi người dùng chuyển tab, có cuộc gọi đến, hoặc khóa màn hình -> Tạm dừng game (`pause`), ngắt kéo `isDragging`, dừng ticker delta jumps.
  - `window.blur` & `pointercancel`: Reset trạng thái kéo lập tức nếu cử chỉ hệ điều hành (vuốt thanh Home Bar, kéo thanh thông báo) can thiệp.
  - Màn hình Pause trực quan cho phép người chơi bấm tiếp tục hoặc chơi lại mà không mất điểm.

---

### 4. [x] Tích hợp MediaPipe hoặc TensorFlow.js để nhận diện đối tượng
- **Module Vision AI**: Triển khai trong [`src/services/visionDetector.ts`](file:///home/hieult/Camera%20Mini-game%20Demo/src/services/visionDetector.ts).
- **3 Chế độ Nhận diện Linh hoạt**:
  1. **MediaPipe HandLandmarker v0.10**: Tải động WebAssembly và mô hình nhận diện bàn tay 21 điểm (float16 GPU delegate), theo dõi vị trí đầu ngón tay trỏ.
  2. **Realtime Motion & Quang phổ Centroid**: Bộ nhận diện siêu nhẹ (~1ms), quét tọa độ trọng tâm điểm sáng/chuyển động của camera frame, hoạt động 100% offline không cần tải mô hình từ CDN.
  3. **Interactive Virtual Simulation**: Chế độ giả lập chuyển động quỹ đạo mượt mà giúp người dùng trải nghiệm ngay cả khi không bật camera.
- **Bộ lọc làm mượt Tọa độ (EMA Smoother)**: Bộ lọc tần số thấp (Exponential Moving Average) loại bỏ hiện tượng giật rung (jitter) của landmark khi camera rung lắc trên điện thoại.

---

### 5. [x] Đo FPS, theo dõi thời gian xử lý và tối ưu trên điện thoại thật
- **Bảng Đo Hiệu năng Thời gian thực** ([`src/components/PerformanceOverlay.tsx`](file:///home/hieult/Camera%20Mini-game%20Demo/src/components/PerformanceOverlay.tsx)):
  - **FPS thực tế**: Tính trung bình trượt thời gian thực (hiển thị màu Xanh/Vàng/Đỏ).
  - **Inference Time (ms)**: Đo độ trễ xử lý của thuật toán nhận diện thị giác trên từng khung hình.
  - **Render Time (ms)** & **Frame Drops**: Theo dõi số khung hình bị rơi.
  - **Entities Count**: Số lượng mục tiêu và hạt đang hoạt động trên WebGL.
- **Tối ưu hóa Di động**:
  - **Dynamic Resolution Scaling**: Tùy chọn 50% (Tiết kiệm), 75% (Cân bằng), 100% (Sắc nét) thay đổi trực tiếp độ phân giải renderer của PixiJS.
  - **Giới hạn DPR (Device Pixel Ratio)**: Khóa DPR tối đa ở mức 2.0 để ngăn màn hình 3x/4x Super AMOLED/Retina làm quá tải GPU di động.
  - **Chế độ Tiết kiệm Pin (Battery Saver)**: Giảm 60% số lượng hạt và giới hạn mục tiêu xuất hiện để giảm tỏa nhiệt.
  - **CSS Safe-Area & Touch**: Ngăn chặn hoàn toàn pull-to-refresh và chạm nhầm trên iOS Safari / Android Chrome (`overscroll-behavior: none`, `touch-action: none`).

---

### 6. [x] Xử lý mất mạng, retry, tải config có version và đồng bộ trạng thái
- **Tải Cấu hình có Phiên bản (Versioned Config)** ([`src/services/configService.ts`](file:///home/hieult/Camera%20Mini-game%20Demo/src/services/configService.ts)):
  - Đọc file cấu hình từ [`public/game-config.json`](file:///home/hieult/Camera%20Mini-game%20Demo/public/game-config.json) chứa `version: "1.3.0"`, tốc độ, tỷ lệ xuất hiện, điểm số.
  - Cơ chế **Exponential Backoff với Jitter**: Tự động thử lại khi mất mạng hoặc kết nối mạng chập chờn.
  - **Bộ nhớ đệm (Cache Fallback)**: Tự động lưu cấu hình mới nhất vào `localStorage`; khi offline, nạp tức thì từ cache mà không làm gián đoạn game.
- **Đồng bộ Trạng thái Ngoại tuyến (Offline State Sync)** ([`src/services/syncService.ts`](file:///home/hieult/Camera%20Mini-game%20Demo/src/services/syncService.ts)):
  - Hàng đợi (Outbox Queue): Điểm số và kỷ lục ghi nhận khi ngoại tuyến được đưa vào danh sách chờ.
  - Tự động phát hiện khi thiết bị có mạng trở lại (`window.addEventListener('online')`) để xả hàng đợi và đồng bộ lên máy chủ.
  - Banner hiển thị trực quan trạng thái mạng (Online/Offline), phiên bản config, và số lượt điểm đang chờ đồng bộ kèm nút "Đồng bộ ngay".

---

## 🚀 Hướng dẫn Cài đặt & Chạy Dự án

### Yêu cầu môi trường
- **Node.js**: >= 18 (Đã kiểm tra trên Node.js v24)
- **Trình duyệt**: Hỗ trợ WebGL và WebRTC Camera (Chrome, Safari, Edge, Firefox trên PC/Mobile)

### Khởi chạy môi trường phát triển (Dev)
```bash
# Cài đặt thư viện nếu chưa có
npm install

# Khởi chạy Vite Server (lắng nghe mọi IP mạng LAN)
npm run dev
```

### Mở trên điện thoại di động trong mạng WiFi nội bộ
1. Sau khi chạy `npm run dev`, Vite sẽ hiển thị địa chỉ LAN (ví dụ: `http://192.168.1.x:3000`).
2. *Lưu ý về quyền Camera trên điện thoại*: Trình duyệt di động (như Chrome/Safari) yêu cầu bảo mật HTTPS hoặc `localhost` để bật camera.
   - Khi test trên điện thoại, bạn có thể chạy qua tunnel HTTPS miễn phí (ví dụ Cloudflare Tunnel hoặc ngrok):
     ```bash
     npx localtunnel --port 3000
     ```
   - Hoặc bật cờ `chrome://flags/#unsafely-treat-insecure-origin-as-secure` trên Chrome di động trỏ đến IP máy tính của bạn.

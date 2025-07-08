# Training Track Management System

Hệ thống quản lý tiến độ đào tạo cho nhân viên công ty với khả năng cập nhật hàng ngày, hiển thị tiến độ công khai, hệ thống hỗ trợ và forum thảo luận.

## ✨ Tính năng

- 🔐 **Hệ thống xác thực**: Đăng ký, đăng nhập, phân quyền
- 📚 **Quản lý khóa học**: Tạo và quản lý các khóa đào tạo
- 📊 **Theo dõi tiến độ**: Cập nhật tiến độ hàng ngày (giờ đào tạo, nội dung, trạng thái)
- 🆘 **Hệ thống hỗ trợ**: Yêu cầu hỗ trợ tự động khi gặp khó khăn
- 💬 **Forum thảo luận**: Thảo luận cho từng khóa học với hỗ trợ hình ảnh
- 👨‍💼 **Dashboard Admin**: Quản lý nhân viên, khóa học, xử lý yêu cầu hỗ trợ
- 📱 **Responsive Design**: Giao diện thân thiện trên mọi thiết bị

## 🛠 Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Template Engine**: Handlebars
- **Styling**: Tailwind CSS
- **Authentication**: Session-based với bcrypt
- **File Upload**: Multer (hỗ trợ nhiều hình ảnh)
- **Containerization**: Docker + Docker Compose

## 📋 Yêu cầu hệ thống

- Node.js 18+
- Docker & Docker Compose
- Git

## 🚀 Hướng dẫn cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd mvp-train-track
```

### 2. Cài đặt dependencies

```bash
npm install
# hoặc
make install
```

### 3. Chọn phương thức chạy

#### Phương thức 1: Development (Khuyến nghị)
Server chạy trực tiếp trên host, chỉ database chạy trong Docker:

```bash
# Khởi động database
npm run dev:db
# hoặc
make dev-db

# Trong terminal khác, chạy server
npm run dev
# hoặc
make dev

# Hoặc chạy cả hai cùng lúc
npm run dev:full
# hoặc
make dev-full
```

#### Phương thức 2: Production
Toàn bộ hệ thống chạy trong Docker:

```bash
npm run docker:prod
# hoặc
make up
```

### 4. Setup database

```bash
# Tạo database schema
npx prisma migrate dev
# hoặc
make migrate

# (Tùy chọn) Thêm dữ liệu mẫu
npx prisma db seed
# hoặc
make seed
```

### 5. Truy cập ứng dụng

- **Development**: http://localhost:3000
- **Production**: http://localhost:3000
- **Database**: PostgreSQL trên port 5444
- **Prisma Studio**: `npx prisma studio`

## ⚙️ Cấu hình Environment

Hệ thống tự động load file environment dựa trên `NODE_ENV`:

### Development (`.env.development` hoặc `env.development`)
```env
DATABASE_URL="postgresql://training_user:training_password@localhost:5444/training_track"
SESSION_SECRET="dev-secret-key-not-for-production"
PORT=3000
NODE_ENV=development
```

### Production (`.env.production` hoặc `env.production`)
```env
DATABASE_URL="postgresql://training_user:training_password@postgres:5432/training_track"
SESSION_SECRET="your-super-secret-session-key-change-this-in-production"
PORT=3000
NODE_ENV=production
SECURE_COOKIES=true
```

## 📁 Cấu trúc thư mục

```
mvp-train-track/
├── prisma/                 # Database schema và migrations
├── routes/                 # Express routes
├── views/                  # Handlebars templates
├── public/                 # Static assets
├── src/                    # Source files
├── docker-compose.yml      # Production Docker config
├── docker-compose.dev.yml  # Development Docker config (chỉ DB)
├── Dockerfile             # Production Dockerfile
├── server.js              # Main application file
├── package.json           # Dependencies và scripts
├── Makefile              # Command shortcuts
└── README.md             # Documentation
```

## 🎯 Workflow phát triển

### Development
```bash
# 1. Khởi động database
make dev-db

# 2. Chạy migrations (nếu cần)
make migrate

# 3. Chạy server development
make dev

# 4. Build CSS (terminal riêng)
npm run build:css
```

### Production
```bash
# 1. Build và chạy production
make build
make up

# 2. Kiểm tra logs
make logs

# 3. Dừng services
make down
```

## 📊 Database Schema

- **User**: Người dùng và thông tin xác thực
- **Course**: Khóa đào tạo
- **CourseEnrollment**: Đăng ký khóa học
- **TrainingProgress**: Tiến độ đào tạo hàng ngày
- **SupportRequest**: Yêu cầu hỗ trợ
- **ForumPost/ForumComment**: Hệ thống forum
- **Image Tables**: Lưu trữ hình ảnh cho posts/comments

## 🔧 Commands hữu ích

```bash
# Makefile commands
make help              # Hiển thị tất cả commands
make install           # Cài đặt dependencies
make dev-db           # Khởi động database development
make dev              # Chạy server development
make dev-full         # Chạy cả database và server
make dev-stop         # Dừng database development
make build            # Build production images
make up               # Khởi động production
make down             # Dừng containers
make logs             # Xem logs
make migrate          # Chạy database migrations
make clean            # Cleanup containers và volumes

# NPM scripts
npm run dev           # Development server
npm run dev:db        # Khởi động database
npm run dev:full      # Chạy cả database và server
npm run build:css     # Build CSS với watch mode
npm run docker:prod   # Production Docker
npm run prisma:studio # Prisma Studio GUI
```

## 🚨 Troubleshooting

### Database connection issues
```bash
# Kiểm tra database có chạy không
docker ps

# Restart database
make dev-stop
make dev-db

# Kiểm tra logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Port conflicts
- PostgreSQL: Port 5444 (có thể đổi trong docker-compose.dev.yml)
- Application: Port 3000 (có thể đổi trong .env)
- Redis: Port 6379

### Permission issues
```bash
# Fix permission cho uploads folder
mkdir -p public/uploads
chmod 755 public/uploads
```

## 📝 Notes

- File uploads được lưu trong `public/uploads/`
- Session được lưu trong PostgreSQL
- CSS được build từ Tailwind với watch mode
- Database schema được quản lý bởi Prisma
- Development server có hot reload với nodemon

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết. 
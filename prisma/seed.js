const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear all existing data
  console.log("🗑️ Clearing existing data...");
  await prisma.$transaction([
    prisma.forumCommentImage.deleteMany(),
    prisma.forumComment.deleteMany(),
    prisma.forumPostImage.deleteMany(),
    prisma.forumPost.deleteMany(),
    prisma.supportRequestImage.deleteMany(),
    prisma.supportRequest.deleteMany(),
    prisma.trainingProgress.deleteMany(),
    prisma.courseEnrollment.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log("✅ Database cleared");

  // Sử dụng transaction để đảm bảo rollback nếu có lỗi
  await prisma.$transaction(
    async (tx) => {
      // Tạo admin user
      const adminPassword = await bcrypt.hash("admin123", 10);
      const admin = await tx.user.upsert({
        where: { email: "admin@training.com" },
        update: {},
        create: {
          email: "admin@training.com",
          name: "Administrator",
          password: adminPassword,
          role: "admin",
        },
      });
      console.log("✅ Created admin user:", admin.email);

      // Tạo user thường
      const userPassword = await bcrypt.hash("user123", 10);
      const user1 = await tx.user.upsert({
        where: { email: "user1@training.com" },
        update: {},
        create: {
          email: "user1@training.com",
          name: "Nguyễn Văn A",
          password: userPassword,
          role: "user",
        },
      });
      console.log("✅ Created test user");

      // Tạo 2 khóa học chính: FE và BE
      const courses = [
        {
          name: "Frontend Development with React",
          description:
            "Lộ trình đào tạo Frontend toàn diện với React 18, từ JavaScript đến TypeScript. Học viên sẽ được thực hành qua các dự án thực tế như Todo List, Shopping Cart và hệ thống POS. Khóa học tập trung vào React Hooks, State Management, và modern development practices.",
          duration: 20,
          track: "frontend",
          level: "comprehensive",
          techStack: [
            "React",
            "JavaScript",
            "TypeScript",
            "Redux",
            "Material UI",
          ],
          projectUrl: "https://github.com/duyvu871/setup-blank-linux-web-server/blob/main/documents/roadmaps/FE-training.md",
        },
        {
          name: "Backend Development with Express.js",
          description:
            "Lộ trình đào tạo Backend toàn diện với Express.js và MongoDB. Học viên sẽ được thực hành xây dựng REST APIs, authentication system, và backend cho hệ thống POS. Khóa học chú trọng vào API design, security, và scalable architecture.",
          duration: 20,
          track: "backend",
          level: "comprehensive",
          techStack: [
            "Express.js",
            "JavaScript",
            "TypeScript",
            "MongoDB",
            "REST API",
          ],
          projectUrl: "https://github.com/duyvu871/setup-blank-linux-web-server/blob/main/documents/roadmaps/BE-training.md",
        },
      ];

      const createdCourses = [];
      for (const courseData of courses) {
        const course = await tx.course.create({
          data: courseData,
        });
        console.log(`✅ Created course: ${course.name}`);
        createdCourses.push(course);
      }

      // Đăng ký user vào cả 2 khóa học
      for (const course of createdCourses) {
        await tx.courseEnrollment.create({
          data: {
            userId: user1.id,
            courseId: course.id,
            status: "active",
          },
        });
      }
      console.log("✅ Enrolled test user in both courses");

      console.log("🎉 Database seeding completed successfully!");
    },
    {
      maxWait: 20000, // Chờ tối đa 20 giây để acquire transaction
      timeout: 60000, // Transaction timeout 60 giây
    }
  );

  console.log("\n📋 Created accounts:");
  console.log("👨‍💼 Admin: admin@training.com / admin123");
  console.log("👤 User: user1@training.com / user123");
  console.log("\n📚 Created 2 main courses: Frontend and Backend tracks");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    console.error("🔄 Transaction automatically rolled back");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

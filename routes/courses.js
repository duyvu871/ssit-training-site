const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Get all courses
router.get('/', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            include: {
                _count: {
                    select: { enrollments: true }
                },
                enrollments: {
                    where: { userId: req.user.id },
                    select: {
                        id: true,
                        status: true,
                        completionPercentage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        res.render('courses/index', { 
            title: 'Danh sách khóa học',
            courses
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        req.flash('error', 'Có lỗi xảy ra khi tải danh sách khóa học');
        res.redirect('/');
    }
});

// Get course details
router.get('/:id', async (req, res) => {
    try {
        const courseId = req.params.id;
        
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                _count: {
                    select: { enrollments: true }
                }
            }
        });

        if (!course) {
            req.flash('error', 'Không tìm thấy khóa học');
            return res.redirect('/courses');
        }

        // Check if user is enrolled
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: {
                userId_courseId: {
                    userId: req.user.id,
                    courseId: courseId
                }
            },
            include: {
                trainingProgress: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        // Get progress of all enrolled users
        const usersProgress = await prisma.courseEnrollment.findMany({
            where: { courseId },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                trainingProgress: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        }).then(enrollments => {
            return enrollments.map(enrollment => ({
                user: enrollment.user,
                status: enrollment.status,
                completionPercentage: enrollment.completionPercentage,
                currentContent: enrollment.trainingProgress[0]?.currentContent || 'Chưa bắt đầu',
                totalHours: enrollment.trainingProgress.reduce((sum, p) => sum + p.hours, 0),
                lastUpdate: enrollment.trainingProgress[0]?.date || enrollment.enrolledAt,
                needsSupport: enrollment.trainingProgress[0]?.needsSupport || false
            }));
        });

        res.render('courses/detail', {
            title: course.name,
            course,
            isEnrolled: !!enrollment,
            enrollment,
            usersProgress
        });
    } catch (error) {
        console.error('Error fetching course details:', error);
        req.flash('error', 'Có lỗi xảy ra khi tải thông tin khóa học');
        res.redirect('/courses');
    }
});

// Enroll in a course
router.post('/:id/enroll', async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;

        // Check if course exists
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            req.flash('error', 'Không tìm thấy khóa học');
            return res.redirect('/courses');
        }

        if (!course.isActive) {
            req.flash('error', 'Khóa học này hiện đang đóng');
            return res.redirect('/courses');
        }

        // Check if already enrolled
        const existingEnrollment = await prisma.courseEnrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            }
        });

        if (existingEnrollment) {
            req.flash('error', 'Bạn đã đăng ký khóa học này rồi');
            return res.redirect(`/courses/${courseId}`);
        }

        // Create enrollment
        await prisma.courseEnrollment.create({
            data: {
                userId,
                courseId
            }
        });

        // Create welcome notification
        await prisma.notification.create({
            data: {
                userId,
                title: 'Chào mừng bạn đến với khóa học mới',
                content: `Bạn đã đăng ký thành công khóa học "${course.name}". Hãy bắt đầu học ngay!`,
                type: 'course',
                link: `/courses/${courseId}`
            }
        });

        // Notify admin
        const admins = await prisma.user.findMany({
            where: { role: 'admin' }
        });

        await prisma.notification.createMany({
            data: admins.map(admin => ({
                userId: admin.id,
                title: 'Học viên mới đăng ký khóa học',
                content: `${req.user.name} đã đăng ký khóa học "${course.name}"`,
                type: 'admin',
                link: `/admin/courses`
            }))
        });

        req.flash('success', 'Đăng ký khóa học thành công');
        res.redirect(`/courses/${courseId}`);
    } catch (error) {
        console.error('Error enrolling in course:', error);
        req.flash('error', 'Có lỗi xảy ra khi đăng ký khóa học');
        res.redirect(`/courses/${req.params.id}`);
    }
});

// Admin routes
router.get('/admin/courses/:id', isAdmin, async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id }
        });
        
        if (!course) {
            return res.status(404).json({ error: 'Không tìm thấy khóa học' });
        }
        
        res.json(course);
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi tải thông tin khóa học' });
    }
});

router.post('/admin/courses', isAdmin, async (req, res) => {
    try {
        const { name, description, duration, track, level, techStack, projectUrl, isActive } = req.body;
        
        const course = await prisma.course.create({
            data: {
                name,
                description,
                duration: parseInt(duration),
                track,
                level,
                techStack: techStack.split(',').map(tech => tech.trim()),
                projectUrl,
                isActive: isActive === 'on'
            }
        });
        
        req.flash('success', 'Tạo khóa học mới thành công');
        res.redirect('/admin/courses');
    } catch (error) {
        console.error('Error creating course:', error);
        req.flash('error', 'Có lỗi xảy ra khi tạo khóa học');
        res.redirect('/admin/courses');
    }
});

router.post('/admin/courses/:id', isAdmin, async (req, res) => {
    try {
        const { name, description, duration, track, level, techStack, projectUrl, isActive } = req.body;
        
        const updateData = {
            name,
            description,
            duration: parseInt(duration),
            track,
            level,
            techStack: techStack.split(',').map(tech => tech.trim()),
            projectUrl,
            isActive: isActive === 'on'
        }

        await prisma.course.update({
            where: { id: req.params.id },
            data: updateData
        });
        
        req.flash('success', 'Cập nhật khóa học thành công');
        res.redirect('/admin/courses');
    } catch (error) {
        console.error('Error updating course:', error);
        req.flash('error', 'Có lỗi xảy ra khi cập nhật khóa học');
        res.redirect('/admin/courses');
    }
});

router.delete('/admin/courses/:id', isAdmin, async (req, res) => {
    try {
        await prisma.course.delete({
            where: { id: req.params.id }
        });
        
        req.flash('success', 'Xóa khóa học thành công');
        res.redirect('/admin/courses');
    } catch (error) {
        console.error('Error deleting course:', error);
        req.flash('error', 'Có lỗi xảy ra khi xóa khóa học');
        res.redirect('/admin/courses');
    }
});

module.exports = router; 
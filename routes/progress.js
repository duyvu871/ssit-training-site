const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { body, validationResult } = require("express-validator");
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Add progress form
router.get('/add/:courseId', async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.user.id;

        // Get course info
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            req.flash('error', 'Không tìm thấy khóa học');
            return res.redirect('/courses');
        }

        // Check if user is enrolled
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            }
        });

        if (!enrollment) {
            req.flash('error', 'Bạn chưa đăng ký khóa học này');
            return res.redirect('/courses');
        }

        // Get today's date in YYYY-MM-DD format for max date input
        const today = new Date().toISOString().split('T')[0];

        res.render('progress/add', {
            title: 'Cập nhật tiến độ',
            course,
            today
        });
    } catch (error) {
        console.error('Error loading progress form:', error);
        req.flash('error', 'Có lỗi xảy ra khi tải form cập nhật tiến độ');
        res.redirect('/courses');
    }
});

// Add progress
router.post('/add/:courseId', async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.user.id;
        const { date, hours, currentContent, notes, completionStatus, needsSupport } = req.body;

        // Validate date
        const progressDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (progressDate > today) {
            req.flash('error', 'Không thể cập nhật tiến độ cho ngày trong tương lai');
            return res.redirect(`/progress/add/${courseId}`);
        }

        // Get enrollment
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            },
            include: {
                trainingProgress: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!enrollment) {
            req.flash('error', 'Bạn chưa đăng ký khóa học này');
            return res.redirect('/courses');
        }

        // Check if progress for this date already exists
        const existingProgress = await prisma.trainingProgress.findUnique({
            where: {
                enrollmentId_date: {
                    enrollmentId: enrollment.id,
                    date: progressDate
                }
            }
        });

        if (existingProgress) {
            // Update existing progress
            await prisma.trainingProgress.update({
                where: {
                    enrollmentId_date: {
                        enrollmentId: enrollment.id,
                        date: progressDate
                    }
                },
                data: {
                    hours: parseFloat(hours),
                    currentContent,
                    notes,
                    completionStatus,
                    needsSupport: needsSupport === 'on'
                }
            });

            req.flash('success', 'Cập nhật tiến độ thành công');
        } else {
            // Create new progress
            await prisma.trainingProgress.create({
                data: {
                    enrollmentId: enrollment.id,
                    date: progressDate,
                    hours: parseFloat(hours),
                    currentContent,
                    notes,
                    completionStatus,
                    needsSupport: needsSupport === 'on'
                }
            });

            req.flash('success', 'Thêm tiến độ mới thành công');
        }

        // Update completion percentage
        const totalDays = enrollment.trainingProgress.length;
        const completedDays = enrollment.trainingProgress.filter(p => p.completionStatus === 'completed').length;
        const completionPercentage = Math.round((completedDays / totalDays) * 100);

        await prisma.courseEnrollment.update({
            where: { id: enrollment.id },
            data: { completionPercentage }
        });

        res.redirect(`/courses/${courseId}`);
    } catch (error) {
        console.error('Error adding progress:', error);
        req.flash('error', 'Có lỗi xảy ra khi cập nhật tiến độ');
        res.redirect(`/progress/add/${req.params.courseId}`);
    }
});

// View progress history
router.get('/history/:courseId', async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.user.id;

        // Get course info
        const course = await prisma.course.findUnique({
            where: { id: courseId }
        });

        if (!course) {
            req.flash('error', 'Không tìm thấy khóa học');
            return res.redirect('/courses');
        }

        // Get enrollment with progress history
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId
                }
            },
            include: {
                trainingProgress: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!enrollment) {
            req.flash('error', 'Bạn chưa đăng ký khóa học này');
            return res.redirect('/courses');
        }

        res.render('progress/history', {
            title: 'Lịch sử đào tạo',
            course,
            enrollment: {
                ...enrollment,
                totalHours: enrollment.trainingProgress.reduce((sum, p) => sum + p.hours, 0),
            }
        });
    } catch (error) {
        console.error('Error loading progress history:', error);
        req.flash('error', 'Có lỗi xảy ra khi tải lịch sử đào tạo');
        res.redirect('/courses');
    }
});

module.exports = router;

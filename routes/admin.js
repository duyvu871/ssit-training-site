const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin middleware to all routes
router.use(isAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    // Get stats
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.courseEnrollment.count(),
      prisma.supportRequest.count({ where: { status: 'pending' } })
    ]);

    const [totalUsers, totalCourses, totalEnrollments, pendingSupportRequests] = stats;

    // Recent activities
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true }
    });

    const recentSupportRequests = await prisma.supportRequest.findMany({
      include: {
        user: { select: { name: true } },
        course: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: {
        totalUsers,
        totalCourses,
        totalEnrollments,
        pendingSupportRequests
      },
      recentUsers,
      recentSupportRequests
    });

  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    req.session.error_msg = 'Không thể tải trang quản trị';
    res.redirect('/courses');
  }
});

// Manage courses
router.get('/courses', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: {
            enrollments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.render('admin/courses', {
      title: 'Quản lý khóa học',
      courses
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    req.session.error_msg = 'Không thể tải danh sách khóa học';
    res.redirect('/admin');
  }
});

// Get course by ID (for edit form)
router.get('/courses/:id', async (req, res) => {
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

// Create new course
router.post('/courses', async (req, res) => {
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

// Update course
router.post('/courses/:id', async (req, res) => {
    try {
        const { name, description, duration, track, level, techStack, projectUrl, isActive } = req.body;
        
        const updateData = {
            name,
            description,
            duration: parseInt(duration),
            track,
            level,
            techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(tech => tech.trim()) : []),
            projectUrl,
            isActive: isActive === 'on'
        }

        console.log('update course', updateData);
        

        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                _count: {
                    select: {
                        enrollments: true
                    }
                }
            }
        });

        // Send notification to enrolled users about course update
        const enrollments = await prisma.courseEnrollment.findMany({
            where: { courseId: course.id },
            select: { userId: true }
        });

        if (enrollments.length > 0) {
            await prisma.notification.createMany({
                data: enrollments.map(enrollment => ({
                    userId: enrollment.userId,
                    title: 'Cập nhật khóa học',
                    content: `Khóa học "${course.name}" đã được cập nhật`,
                    type: 'course',
                    link: `/courses/${course.id}`
                }))
            });
        }
        
        res.render('admin/edit-course', {
            title: 'Chỉnh sửa khóa học',
            course,
            layout: 'admin',
            active: 'courses',
            success_msg: 'Cập nhật khóa học thành công'
        });
    } catch (error) {
        console.error('Error updating course:', error);
        
        // Get original course data to re-render form
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: {
                        enrollments: true
                    }
                }
            }
        });
        
        res.render('admin/edit-course', {
            title: 'Chỉnh sửa khóa học',
            course,
            layout: 'admin',
            active: 'courses',
            error_msg: 'Có lỗi xảy ra khi cập nhật khóa học'
        });
    }
});

// Delete course
router.delete('/courses/:id', async (req, res) => {
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

// Toggle course active status
router.post('/courses/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ error: 'Khóa học không tồn tại' });
    }

    await prisma.course.update({
      where: { id },
      data: { isActive: !course.isActive }
    });

    res.json({ success: true, isActive: !course.isActive });

  } catch (error) {
    console.error('Error toggling course status:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái' });
  }
});

// Manage users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            courseEnrollments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.render('admin/users', {
      title: 'Quản lý nhân viên',
      users
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    req.session.error_msg = 'Không thể tải danh sách người dùng';
    res.redirect('/admin');
  }
});

// Toggle user role
router.post('/users/:id/toggle-role', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Nhân viên không tồn tại' });
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';

    await prisma.user.update({
      where: { id },
      data: { role: newRole }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({ error: 'Không thể thay đổi vai trò' });
  }
});

// Support requests
router.get('/support', async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereCondition = {};
    if (status && ['pending', 'in_progress', 'resolved'].includes(status)) {
      whereCondition.status = status;
    }

    const [supportRequests, pendingCount, inProgressCount, resolvedCount, totalCount] = await Promise.all([
      prisma.supportRequest.findMany({
        where: whereCondition,
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { name: true } },
          images: true
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.supportRequest.count({ where: { status: 'pending' } }),
      prisma.supportRequest.count({ where: { status: 'in_progress' } }),
      prisma.supportRequest.count({ where: { status: 'resolved' } }),
      prisma.supportRequest.count()
    ]);

    res.render('admin/support', {
      title: 'Quản lý yêu cầu hỗ trợ',
      supportRequests,
      currentStatus: status,
      pendingCount,
      inProgressCount,
      resolvedCount,
      totalCount
    });

  } catch (error) {
    console.error('Error fetching support requests:', error);
    req.session.error_msg = 'Không thể tải yêu cầu hỗ trợ';
    res.redirect('/admin');
  }
});

// Update support request status
router.post('/support/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    const updateData = { status };
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    await prisma.supportRequest.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating support status:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái' });
  }
});

// Respond to support request
router.post('/support/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminResponse } = req.body;

    if (!adminResponse || adminResponse.trim().length === 0) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }

    await prisma.supportRequest.update({
      where: { id },
      data: {
        adminResponse: adminResponse.trim(),
        responseDate: new Date(),
        status: 'in_progress'
      }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error responding to support request:', error);
    res.status(500).json({ error: 'Không thể gửi phản hồi' });
  }
});

// Course progress overview
router.get('/courses/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            trainingProgress: {
              orderBy: { date: 'desc' }
            }
          }
        }
      }
    });

    if (!course) {
      req.session.error_msg = 'Khóa học không tồn tại';
      return res.redirect('/admin/courses');
    }

    // Calculate stats
    const totalEnrolled = course.enrollments.length;
    const totalCompleted = course.enrollments.filter(e => e.status === 'completed').length;
    const totalInProgress = course.enrollments.filter(e => e.status === 'active').length;
    const avgCompletionRate = totalEnrolled > 0 ? 
      Math.round(course.enrollments.reduce((sum, e) => sum + e.completionPercentage, 0) / totalEnrolled) : 0;

    // Process enrollments data
    const enrollments = course.enrollments.map(enrollment => {
      const totalHours = enrollment.trainingProgress.reduce((sum, p) => sum + p.hours, 0);
      const lastProgress = enrollment.trainingProgress[0];
      const needsSupport = enrollment.trainingProgress.some(p => p.needsSupport);

      return {
        ...enrollment,
        totalHours,
        lastProgressDate: lastProgress?.date,
        needsSupport
      };
    });

    // Recent progress for activity feed
    const recentProgress = await prisma.trainingProgress.findMany({
      where: {
        enrollment: {
          courseId: id
        }
      },
      include: {
        enrollment: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    const processedRecentProgress = recentProgress.map(progress => ({
      ...progress,
      user: progress.enrollment.user
    }));

    res.render('admin/course-progress', {
      title: `Tiến độ khóa học`,
      course,
      enrollments,
      stats: {
        totalEnrolled,
        totalCompleted,
        totalInProgress,
        avgCompletionRate
      },
      recentProgress: processedRecentProgress
    });

  } catch (error) {
    console.error('Error fetching course progress:', error);
    req.session.error_msg = 'Không thể tải tiến độ khóa học';
    res.redirect('/admin/courses');
  }
});

// Get user details for modal
router.get('/users/:userId/course/:courseId/details', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        userId: userId,
        courseId: courseId
      },
      include: {
        user: true,
        trainingProgress: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Không tìm thấy đăng ký' });
    }

    const totalHours = enrollment.trainingProgress.reduce((sum, p) => sum + p.hours, 0);
    const totalDays = enrollment.trainingProgress.length;

    res.json({
      user: enrollment.user,
      totalHours,
      totalDays,
      completionPercentage: enrollment.completionPercentage,
      recentProgress: enrollment.trainingProgress.map(p => ({
        currentContent: p.currentContent,
        hours: p.hours,
        date: p.date.toLocaleDateString('vi-VN'),
        needsSupport: p.needsSupport
      }))
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Không thể tải thông tin chi tiết' });
  }
});

// Pause enrollment
router.post('/enrollments/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.courseEnrollment.update({
      where: { id },
      data: { status: 'paused' }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error pausing enrollment:', error);
    res.status(500).json({ error: 'Không thể tạm dừng đăng ký' });
  }
});

// Resume enrollment
router.post('/enrollments/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.courseEnrollment.update({
      where: { id },
      data: { status: 'active' }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error resuming enrollment:', error);
    res.status(500).json({ error: 'Không thể tiếp tục đăng ký' });
  }
});

// Get course edit page
router.get('/courses/:id/edit', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: {
                        enrollments: true
                    }
                }
            }
        });

        if (!course) {
            req.flash('error_msg', 'Không tìm thấy khóa học');
            return res.redirect('/admin/courses');
        }

        res.render('admin/edit-course', {
            course,
            title: 'Chỉnh sửa khóa học',
            layout: 'main'
        });
    } catch (err) {
        console.error('Error getting course edit page:', err);
        req.flash('error_msg', 'Có lỗi xảy ra khi tải thông tin khóa học');
        res.redirect('/admin/courses');
    }
});

// Get course create page
router.get('/courses/new', (req, res) => {
    res.render('admin/edit-course', {
        title: 'Thêm khóa học mới',
        layout: 'admin',
        course: {
            duration: 20,
            track: 'frontend',
            level: 'basic',
            isActive: true,
            techStack: []
        }
    });
});

module.exports = router; 
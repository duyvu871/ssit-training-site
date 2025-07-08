const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { uploadMultiple, handleUploadErrors } = require('../middleware/upload');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Forum posts for specific course
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.session.user.id;

    // Check enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      },
      include: { course: true }
    });

    if (!enrollment) {
      req.session.error_msg = 'Bạn chưa đăng ký khóa học này';
      return res.redirect('/courses');
    }

    // Get forum posts
    const posts = await prisma.forumPost.findMany({
      where: { courseId },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, role: true }
            },
            images: true
          },
          orderBy: { createdAt: 'asc' }
        },
        images: true,
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.render('forum/index', {
      title: `Diễn đàn - ${enrollment.course.name}`,
      course: enrollment.course,
      posts
    });

  } catch (error) {
    console.error('Error fetching forum posts:', error);
    req.session.error_msg = 'Không thể tải diễn đàn';
    res.redirect('/courses');
  }
});

// Create new post
router.post('/:courseId/posts', uploadMultiple, handleUploadErrors, [
  body('title').trim().isLength({ min: 1 }).withMessage('Tiêu đề không được để trống'),
  body('content').trim().isLength({ min: 1 }).withMessage('Nội dung không được để trống')
], async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.session.user.id;

    const errors = validationResult(req);
    if (!errors.isEmpty() || req.uploadError) {
      req.session.error_msg = req.uploadError || 'Vui lòng nhập đầy đủ thông tin';
      return res.redirect(`/forum/${courseId}`);
    }

    // Check enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      }
    });

    if (!enrollment) {
      req.session.error_msg = 'Bạn chưa đăng ký khóa học này';
      return res.redirect('/courses');
    }

    const { title, content } = req.body;

    // Create post with transaction for images
    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.forumPost.create({
        data: {
          userId,
          courseId,
          title,
          content
        }
      });

      // Add images if uploaded
      if (req.files && req.files.length > 0) {
        const imageData = req.files.map(file => ({
          postId: newPost.id,
          imageUrl: `/uploads/${file.filename}`,
          filename: file.filename
        }));

        await tx.forumPostImage.createMany({
          data: imageData
        });
      }

      return newPost;
    });

    req.session.success_msg = 'Đăng bài thành công!';
    res.redirect(`/forum/${courseId}`);

  } catch (error) {
    console.error('Error creating forum post:', error);
    req.session.error_msg = 'Không thể đăng bài';
    res.redirect(`/forum/${req.params.courseId}`);
  }
});

// Add comment to post
router.post('/:courseId/posts/:postId/comments', uploadMultiple, handleUploadErrors, [
  body('content').trim().isLength({ min: 1 }).withMessage('Nội dung không được để trống')
], async (req, res) => {
  try {
    const { courseId, postId } = req.params;
    const userId = req.session.user.id;

    const errors = validationResult(req);
    if (!errors.isEmpty() || req.uploadError) {
      req.session.error_msg = req.uploadError || 'Vui lòng nhập nội dung bình luận';
      return res.redirect(`/forum/${courseId}`);
    }

    // Check enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      }
    });

    if (!enrollment) {
      req.session.error_msg = 'Bạn chưa đăng ký khóa học này';
      return res.redirect('/courses');
    }

    // Get post info for notification
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!post) {
      req.session.error_msg = 'Không tìm thấy bài viết';
      return res.redirect(`/forum/${courseId}`);
    }

    const { content } = req.body;

    // Create comment with transaction for images
    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.forumComment.create({
        data: {
          userId,
          postId,
          content
        }
      });

      // Add images if uploaded
      if (req.files && req.files.length > 0) {
        const imageData = req.files.map(file => ({
          commentId: newComment.id,
          imageUrl: `/uploads/${file.filename}`,
          filename: file.filename
        }));

        await tx.forumCommentImage.createMany({
          data: imageData
        });
      }

      return newComment;
    });

    // Send notification to post author if it's not their own comment
    if (post.user.id !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.user.id,
          title: 'Có bình luận mới trong bài viết của bạn',
          content: `${req.session.user.name} đã bình luận: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
          type: 'forum',
          link: `/forum/${courseId}#comment-${comment.id}`
        }
      });
    }

    req.session.success_msg = 'Bình luận thành công!';
    res.redirect(`/forum/${courseId}`);

  } catch (error) {
    console.error('Error creating comment:', error);
    req.session.error_msg = 'Không thể bình luận';
    res.redirect(`/forum/${req.params.courseId}`);
  }
});

// Delete post (only author or admin)
router.delete('/:courseId/posts/:postId', async (req, res) => {
  try {
    const { courseId, postId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const post = await prisma.forumPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Bài viết không tồn tại' });
    }

    // Check permission
    if (post.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này' });
    }

    await prisma.forumPost.delete({
      where: { id: postId }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Không thể xóa bài viết' });
  }
});

// Pin/unpin post (admin only)
router.patch('/:courseId/posts/:postId/pin', async (req, res) => {
  try {
    const { postId } = req.params;
    const userRole = req.session.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này' });
    }

    const post = await prisma.forumPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Bài viết không tồn tại' });
    }

    await prisma.forumPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned }
    });

    res.json({ success: true, isPinned: !post.isPinned });

  } catch (error) {
    console.error('Error pinning post:', error);
    res.status(500).json({ error: 'Không thể thực hiện' });
  }
});

// Get posts for a course
router.get('/posts/:courseId', async (req, res) => {
    try {
        const posts = await prisma.forumPost.findMany({
            where: {
                courseId: req.params.courseId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            },
            orderBy: {
                isPinned: 'desc',
                createdAt: 'desc'
            }
        });

        res.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new post
router.post('/posts/:courseId', async (req, res) => {
    try {
        const { title, content } = req.body;
        const courseId = req.params.courseId;

        const post = await prisma.forumPost.create({
            data: {
                title,
                content,
                courseId,
                userId: req.user.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Create notifications for course enrollees
        const enrollments = await prisma.courseEnrollment.findMany({
            where: {
                courseId,
                userId: {
                    not: req.user.id // Don't notify the post author
                }
            },
            select: {
                userId: true
            }
        });

        // Create notifications in bulk
        await prisma.notification.createMany({
            data: enrollments.map(enrollment => ({
                userId: enrollment.userId,
                title: 'Bài viết mới trong khóa học',
                content: `${req.user.name} đã đăng bài "${title}"`,
                type: 'forum',
                link: `/courses/${courseId}#post-${post.id}`
            }))
        });

        res.json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a post
router.delete('/posts/:id', async (req, res) => {
    try {
        const post = await prisma.forumPost.findUnique({
            where: {
                id: req.params.id
            }
        });

        if (!post || post.userId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.forumPost.delete({
            where: {
                id: req.params.id
            }
        });

        res.json({ message: 'Post deleted' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a comment
router.delete('/comments/:id', async (req, res) => {
    try {
        const comment = await prisma.forumComment.findUnique({
            where: {
                id: req.params.id
            }
        });

        if (!comment || comment.userId !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.forumComment.delete({
            where: {
                id: req.params.id
            }
        });

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 
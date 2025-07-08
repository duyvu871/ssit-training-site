const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { isGuest } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Login form
router.get('/login', isGuest, (req, res) => {
  res.render('auth/login', { 
    title: 'Đăng nhập',
    layout: 'auth' 
  });
});

// Login process
router.post('/login', isGuest, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      req.flash('error', 'Vui lòng nhập đầy đủ thông tin');
      return res.redirect('/auth/login');
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      req.flash('error', 'Email hoặc mật khẩu không đúng');
      return res.redirect('/auth/login');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Email hoặc mật khẩu không đúng');
      return res.redirect('/auth/login');
    }

    // Store user in session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    // Create welcome back notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Chào mừng trở lại',
        content: 'Rất vui được gặp lại bạn! Hãy tiếp tục hành trình học tập của mình.',
        type: 'system'
      }
    });

    req.flash('success', `Chào mừng ${user.name} đã quay trở lại!`);
    res.redirect('/');
  } catch (error) {
    console.error('Error logging in:', error);
    req.flash('error', 'Có lỗi xảy ra khi đăng nhập');
    res.redirect('/auth/login');
  }
});

// Register form
router.get('/register', isGuest, (req, res) => {
  res.render('auth/register', { 
    title: 'Đăng ký',
    layout: 'auth' 
  });
});

// Register process
router.post('/register', isGuest, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validate input
    if (!name || !email || !password || !confirmPassword) {
      req.flash('error', 'Vui lòng nhập đầy đủ thông tin');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Mật khẩu xác nhận không khớp');
      return res.redirect('/auth/register');
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      req.flash('error', 'Email đã được sử dụng');
      return res.redirect('/auth/register');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Chào mừng bạn đến với Training Track',
        content: 'Cảm ơn bạn đã tham gia cùng chúng tôi. Hãy khám phá các khóa học và bắt đầu hành trình học tập của bạn!',
        type: 'system'
      }
    });

    // Notify admin
    const admins = await prisma.user.findMany({
      where: { role: 'admin' }
    });

    await prisma.notification.createMany({
      data: admins.map(admin => ({
        userId: admin.id,
        title: 'Thành viên mới đăng ký',
        content: `${name} (${email}) vừa tạo tài khoản mới`,
        type: 'admin',
        link: '/admin/users'
      }))
    });

    req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Error registering:', error);
    req.flash('error', 'Có lỗi xảy ra khi đăng ký');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router; 
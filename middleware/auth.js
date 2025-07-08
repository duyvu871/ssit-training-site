/**
 * Middleware kiểm tra xác thực người dùng
 */
const isAuthenticated = (req, res, next) => {
    // Kiểm tra session user
    if (!req.session.user) {
        req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
        return res.redirect('/auth/login');
    }
    
    // Gán user vào req để các route có thể sử dụng
    req.user = req.session.user;
    next();
};

/**
 * Middleware kiểm tra quyền admin
 */
const isAdmin = (req, res, next) => {
    // Kiểm tra session user và role
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Bạn không có quyền truy cập trang này');
        return res.redirect('/');
    }

    // Gán user vào req để các route có thể sử dụng
    req.user = req.session.user;
    next();
};

/**
 * Middleware kiểm tra user đã đăng nhập chưa
 * Nếu đã đăng nhập thì chuyển hướng về trang chủ
 */
const isGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isGuest
}; 
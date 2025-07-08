const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware
router.use(isAuthenticated);

// Get notifications with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalCount = await prisma.notification.count({
            where: {
                userId: req.user.id
            }
        });

        // Get paginated notifications
        const notifications = await prisma.notification.findMany({
            where: {
                userId: req.user.id
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: limit
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.json({
            notifications,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalCount,
                itemsPerPage: limit,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: {
                userId: req.user.id,
                isRead: false
            }
        });
        res.json({ count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            data: {
                isRead: true
            }
        });

        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        await prisma.notification.delete({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete all read notifications
router.delete('/clear-read', async (req, res) => {
    try {
        await prisma.notification.deleteMany({
            where: {
                userId: req.user.id,
                isRead: true
            }
        });

        res.json({ message: 'All read notifications cleared' });
    } catch (error) {
        console.error('Error clearing read notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 
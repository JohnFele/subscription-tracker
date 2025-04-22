import { Router } from 'express';
import authorize from '../middlewares/auth.middleware.js';
import { createSubscription, getAllSubscriptions, getSubscription, updateSubscription, deleteSubscription, getUserSubscriptions, getUpcomingSubscriptions, cancelSubscription } from '../controllers/subscription.controller.js';
import restrictTo from '../middlewares/restrict.middleware.js';

const subscriptionRouter = Router();

subscriptionRouter.get('/', authorize, getAllSubscriptions);

subscriptionRouter.get('/:id', authorize, getSubscription);

subscriptionRouter.post('/', authorize, createSubscription);

subscriptionRouter.put('/:id', authorize, updateSubscription);

subscriptionRouter.delete('/:id', authorize, deleteSubscription);

subscriptionRouter.get('/user/:userId', authorize, restrictTo('admin'), getUserSubscriptions);

subscriptionRouter.put('/:id/cancel', authorize, cancelSubscription);

subscriptionRouter.get('/upcoming-subscriptions', authorize, getUpcomingSubscriptions);

export default subscriptionRouter;

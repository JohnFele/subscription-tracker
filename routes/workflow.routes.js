import { Router } from 'express';

const workflowRouter = Router();

workflowRouter.get('/', (req, res) => {
  res.status(200).json({ message: 'Workflow route is working!' });
});

export default workflowRouter;

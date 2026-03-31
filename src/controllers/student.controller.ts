import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';

const studentService = new StudentService();

export class StudentController {
    async getAll(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const search = req.query['search'] as string;
            const busNumber = req.query['busNumber'] as string;
            const pickupStop = req.query['pickupStop'] as string;
            const collegeId = user?.type === 'college' ? user.id : undefined;
            const students = await studentService.getAllStudents(collegeId, search, busNumber, pickupStop);
            res.json(students);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const student = await studentService.getStudentById(req.params.id as string);
            if (!student) return res.status(404).json({ message: 'Student not found' });
            res.json(student);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const student = await studentService.createStudent(req.body);
            res.status(201).json(student);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const student = await studentService.updateStudent(req.params.id as string, req.body);
            res.json(student);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await studentService.deleteStudent(req.params.id as string);
            res.status(204).send();
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async updateNotificationSettings(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            if (!user || !user.id) return res.status(401).json({ message: 'Unauthorized' });
            
            const student = await studentService.updateStudent(user.id, {
                notificationSettings: req.body.notificationSettings
            });
            res.json(student);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
}

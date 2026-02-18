import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';

const studentService = new StudentService();

export class StudentController {
    async getAll(req: Request, res: Response) {
        try {
            const students = await studentService.getAllStudents();
            res.json(students);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
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
}

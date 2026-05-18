import { Request, Response, NextFunction } from 'express';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

export const app = express();
export default prisma;

const port = 3010;
const allowedCvTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const maxCvSize = 5 * 1024 * 1024;

type CandidatePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  education?: string;
  workExperience?: string;
  cv?: {
    fileName?: string;
    mimeType?: string;
    size?: number;
    contentBase64?: string;
  };
};

app.use(express.json({ limit: '7mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRequiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateCandidate(payload: CandidatePayload) {
  const errors: Record<string, string> = {};
  const firstName = getRequiredText(payload.firstName);
  const lastName = getRequiredText(payload.lastName);
  const email = getRequiredText(payload.email).toLowerCase();
  const phone = getRequiredText(payload.phone);
  const address = getRequiredText(payload.address);
  const education = getRequiredText(payload.education);
  const workExperience = getRequiredText(payload.workExperience);

  if (!firstName) errors.firstName = 'El nombre es obligatorio.';
  if (!lastName) errors.lastName = 'El apellido es obligatorio.';
  if (!email) errors.email = 'El correo electronico es obligatorio.';
  if (email && !isValidEmail(email)) errors.email = 'El correo electronico no tiene un formato valido.';
  if (!phone) errors.phone = 'El telefono es obligatorio.';
  if (!address) errors.address = 'La direccion es obligatoria.';
  if (!education) errors.education = 'La educacion es obligatoria.';
  if (!workExperience) errors.workExperience = 'La experiencia laboral es obligatoria.';

  if (payload.cv) {
    const { fileName, mimeType, size, contentBase64 } = payload.cv;

    if (!fileName || !mimeType || !size || !contentBase64) {
      errors.cv = 'El CV debe incluir nombre, tipo, tamano y contenido.';
    } else if (!allowedCvTypes.includes(mimeType)) {
      errors.cv = 'El CV debe ser PDF o DOCX.';
    } else if (size > maxCvSize) {
      errors.cv = 'El CV no debe superar 5 MB.';
    }
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      phone,
      address,
      education,
      workExperience,
      cvFileName: payload.cv?.fileName,
      cvMimeType: payload.cv?.mimeType,
      cvSize: payload.cv?.size,
      cvContentBase64: payload.cv?.contentBase64,
    },
    errors,
  };
}

app.get('/', (req, res) => {
  res.send('Hola LTI!');
});

app.get('/candidates', async (req, res, next) => {
  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        education: true,
        workExperience: true,
        cvFileName: true,
        cvMimeType: true,
        cvSize: true,
        createdAt: true,
      },
    });

    res.json(candidates);
  } catch (error) {
    next(error);
  }
});

app.post('/candidates', async (req, res, next) => {
  try {
    const { data, errors } = validateCandidate(req.body);

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ message: 'Revisa los datos ingresados.', errors });
      return;
    }

    const candidate = await prisma.candidate.create({
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        education: true,
        workExperience: true,
        cvFileName: true,
        cvMimeType: true,
        cvSize: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'El candidato ha sido anadido exitosamente al sistema.',
      candidate,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({
        message: 'Ya existe un candidato registrado con ese correo electronico.',
        errors: { email: 'El correo electronico ya esta registrado.' },
      });
      return;
    }

    next(error);
  }
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'No pudimos completar la operacion. Intenta nuevamente en unos minutos.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type Candidate = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  education: string;
  workExperience: string;
  cvFileName?: string;
  cvSize?: number;
  createdAt: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  education: string;
  workExperience: string;
  cv: File | null;
};

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

const apiUrl = process.env.REACT_APP_API_URL ?? 'http://localhost:3010';
const maxCvSize = 5 * 1024 * 1024;
const allowedCvTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  education: '',
  workExperience: '',
  cv: null,
};

const educationOptions = [
  'Bachillerato',
  'Tecnico superior',
  'Licenciatura',
  'Ingenieria',
  'Maestria',
];

const experienceOptions = [
  'Sin experiencia previa',
  'Atencion al cliente',
  'Ventas',
  'Administracion',
  'Desarrollo de software',
];

function validateForm(form: FormState) {
  const errors: FieldErrors = {};

  if (!form.firstName.trim()) errors.firstName = 'Ingresa el nombre.';
  if (!form.lastName.trim()) errors.lastName = 'Ingresa el apellido.';
  if (!form.email.trim()) {
    errors.email = 'Ingresa el correo electronico.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Usa un correo electronico valido.';
  }
  if (!form.phone.trim()) errors.phone = 'Ingresa el telefono.';
  if (!form.address.trim()) errors.address = 'Ingresa la direccion.';
  if (!form.education.trim()) errors.education = 'Ingresa la educacion.';
  if (!form.workExperience.trim()) errors.workExperience = 'Ingresa la experiencia laboral.';

  if (form.cv) {
    if (!allowedCvTypes.includes(form.cv.type)) {
      errors.cv = 'El CV debe estar en formato PDF o DOCX.';
    } else if (form.cv.size > maxCvSize) {
      errors.cv = 'El CV no debe superar 5 MB.';
    }
  }

  return errors;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const candidateCount = candidates.length;
  const latestCandidate = useMemo(
    () =>
      candidates.reduce<Candidate | undefined>((latest, current) => {
        if (!latest) return current;

        const currentDate = Date.parse(current.createdAt);
        const latestDate = Date.parse(latest.createdAt);

        if (Number.isNaN(currentDate) || Number.isNaN(latestDate)) {
          return current.id > latest.id ? current : latest;
        }

        return currentDate > latestDate ? current : latest;
      }, undefined),
    [candidates]
  );

  useEffect(() => {
    fetch(`${apiUrl}/candidates`)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los candidatos.');
        return response.json();
      })
      .then(setCandidates)
      .catch(() => setLoadError('No pudimos conectar con el servidor de candidatos.'));
  }, []);

  function updateField(field: keyof FormState, value: string | File | null) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setSuccessMessage('');
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    updateField(event.target.name as keyof FormState, event.target.value);
  }

  function handleCvChange(event: ChangeEvent<HTMLInputElement>) {
    updateField('cv', event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const cvPayload = form.cv
        ? {
            fileName: form.cv.name,
            mimeType: form.cv.type,
            size: form.cv.size,
            contentBase64: await fileToBase64(form.cv),
          }
        : undefined;

      const response = await fetch(`${apiUrl}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          education: form.education,
          workExperience: form.workExperience,
          cv: cvPayload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors({ ...(result.errors ?? {}), form: result.message ?? 'No se pudo anadir el candidato.' });
        return;
      }

      setCandidates((current) => [result.candidate, ...current]);
      setForm(emptyForm);
      setIsFormOpen(false);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrors({
        form: 'No pudimos conectar con el servidor. Verifica que el backend este iniciado.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="dashboard">
      <section className="dashboard__header" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Sistema ATS</p>
          <h1 id="dashboard-title">Dashboard del reclutador</h1>
          <p className="dashboard__summary">
            Gestiona candidatos, CVs y datos clave del proceso de seleccion.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setIsFormOpen(true)}>
          + Anadir candidato
        </button>
      </section>

      {successMessage && (
        <div className="alert alert--success" role="status">
          {successMessage}
        </div>
      )}

      {loadError && (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      )}

      <section className="metrics" aria-label="Resumen de candidatos">
        <div className="metric">
          <span className="metric__label">Candidatos</span>
          <strong>{candidateCount}</strong>
        </div>
        <div className="metric">
          <span className="metric__label">Ultimo registro</span>
          <strong>{latestCandidate ? `${latestCandidate.firstName} ${latestCandidate.lastName}` : 'Sin registros'}</strong>
        </div>
      </section>

      {isFormOpen && (
        <section className="form-panel" aria-labelledby="candidate-form-title">
          <div className="form-panel__title">
            <div>
              <h2 id="candidate-form-title">Nuevo candidato</h2>
              <p>Completa los datos necesarios para iniciar su seguimiento.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </button>
          </div>

          {errors.form && (
            <div className="alert alert--error" role="alert">
              {errors.form}
            </div>
          )}

          <form className="candidate-form" onSubmit={handleSubmit} noValidate>
            <label>
              Nombre *
              <input name="firstName" value={form.firstName} onChange={handleInputChange} autoComplete="given-name" />
              {errors.firstName && <span className="field-error">{errors.firstName}</span>}
            </label>

            <label>
              Apellido *
              <input name="lastName" value={form.lastName} onChange={handleInputChange} autoComplete="family-name" />
              {errors.lastName && <span className="field-error">{errors.lastName}</span>}
            </label>

            <label>
              Correo electronico *
              <input name="email" type="email" value={form.email} onChange={handleInputChange} autoComplete="email" />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>

            <label>
              Telefono *
              <input name="phone" value={form.phone} onChange={handleInputChange} autoComplete="tel" />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </label>

            <label className="candidate-form__wide">
              Direccion *
              <input name="address" value={form.address} onChange={handleInputChange} autoComplete="street-address" />
              {errors.address && <span className="field-error">{errors.address}</span>}
            </label>

            <label>
              Educacion *
              <input name="education" list="education-options" value={form.education} onChange={handleInputChange} />
              <datalist id="education-options">
                {educationOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.education && <span className="field-error">{errors.education}</span>}
            </label>

            <label>
              Experiencia laboral *
              <input name="workExperience" list="experience-options" value={form.workExperience} onChange={handleInputChange} />
              <datalist id="experience-options">
                {experienceOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.workExperience && <span className="field-error">{errors.workExperience}</span>}
            </label>

            <label className="candidate-form__wide">
              CV en PDF o DOCX
              <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleCvChange} />
              {errors.cv && <span className="field-error">{errors.cv}</span>}
            </label>

            <div className="candidate-form__actions">
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar candidato'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="candidate-list" aria-labelledby="candidate-list-title">
        <h2 id="candidate-list-title">Candidatos recientes</h2>
        {candidates.length === 0 ? (
          <p className="empty-state">Todavia no hay candidatos registrados.</p>
        ) : (
          <div className="candidate-grid">
            {candidates.map((candidate) => (
              <article className="candidate-card" key={candidate.id}>
                <div>
                  <h3>{candidate.firstName} {candidate.lastName}</h3>
                  <p>{candidate.email}</p>
                </div>
                <dl>
                  <div>
                    <dt>Telefono</dt>
                    <dd>{candidate.phone}</dd>
                  </div>
                  <div>
                    <dt>Educacion</dt>
                    <dd>{candidate.education}</dd>
                  </div>
                  <div>
                    <dt>Experiencia</dt>
                    <dd>{candidate.workExperience}</dd>
                  </div>
                  <div>
                    <dt>CV</dt>
                    <dd>{candidate.cvFileName ?? 'Sin archivo'}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;

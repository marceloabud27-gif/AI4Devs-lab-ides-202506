import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

type InterviewStep = {
  id: number;
  name: string;
  orderIndex: number;
};

type InterviewFlowResponse = {
  positionName: string;
  interviewFlow: {
    interviewSteps: InterviewStep[];
  };
};

type CandidateResponse = {
  id?: number | string;
  applicationId?: number | string;
  candidateId?: number | string;
  fullName: string;
  currentInterviewStep: number | string;
  averageScore: number;
};

type Candidate = CandidateResponse & {
  boardId: string;
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3010';

const fallbackFlow: InterviewFlowResponse = {
  positionName: 'Senior backend engineer',
  interviewFlow: {
    interviewSteps: [
      { id: 1, name: 'Initial Screening', orderIndex: 1 },
      { id: 2, name: 'Technical Interview', orderIndex: 2 },
      { id: 3, name: 'Manager Interview', orderIndex: 3 },
    ],
  },
};

const fallbackCandidates: CandidateResponse[] = [
  {
    id: 1,
    applicationId: 1,
    fullName: 'Jane Smith',
    currentInterviewStep: 'Technical Interview',
    averageScore: 4,
  },
  {
    id: 2,
    applicationId: 2,
    fullName: 'Carlos Garcia',
    currentInterviewStep: 'Initial Screening',
    averageScore: 0,
  },
  {
    id: 3,
    applicationId: 3,
    fullName: 'John Doe',
    currentInterviewStep: 'Manager Interview',
    averageScore: 5,
  },
];

function getPositionId() {
  const match = window.location.pathname.match(/positions\/([^/]+)/);
  return match?.[1] || '1';
}

function getCandidateBoardId(candidate: CandidateResponse, index: number) {
  return String(candidate.applicationId ?? candidate.id ?? candidate.candidateId ?? `candidate-${index}`);
}

function getCandidateApiId(candidate: Candidate) {
  return candidate.applicationId ?? candidate.id ?? candidate.candidateId ?? candidate.boardId;
}

function candidateBelongsToStep(candidate: Candidate, step: InterviewStep) {
  return (
    String(candidate.currentInterviewStep) === String(step.id) ||
    String(candidate.currentInterviewStep).toLowerCase() === step.name.toLowerCase()
  );
}

function App() {
  const [positionName, setPositionName] = useState('');
  const [steps, setSteps] = useState<InterviewStep[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const positionId = getPositionId();

  useEffect(() => {
    let mounted = true;

    async function loadPositionBoard() {
      setLoading(true);
      setError('');

      try {
        const [flowResponse, candidatesResponse] = await Promise.all([
          fetch(`${API_URL}/positions/${positionId}/interviewFlow`),
          fetch(`${API_URL}/positions/${positionId}/candidates`),
        ]);

        if (!flowResponse.ok || !candidatesResponse.ok) {
          throw new Error('No se pudo conectar con la API');
        }

        const flowData: InterviewFlowResponse = await flowResponse.json();
        const candidatesData: CandidateResponse[] = await candidatesResponse.json();

        if (!mounted) {
          return;
        }

        setPositionName(flowData.positionName);
        setSteps(
          [...flowData.interviewFlow.interviewSteps].sort(
            (a, b) => a.orderIndex - b.orderIndex || a.id - b.id,
          ),
        );
        setCandidates(
          candidatesData.map((candidate, index) => ({
            ...candidate,
            boardId: getCandidateBoardId(candidate, index),
          })),
        );
      } catch {
        if (!mounted) {
          return;
        }

        setError('Mostrando datos de ejemplo porque la API no esta disponible.');
        setPositionName(fallbackFlow.positionName);
        setSteps(fallbackFlow.interviewFlow.interviewSteps);
        setCandidates(
          fallbackCandidates.map((candidate, index) => ({
            ...candidate,
            boardId: getCandidateBoardId(candidate, index),
          })),
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPositionBoard();

    return () => {
      mounted = false;
    };
  }, [positionId]);

  const candidatesByStep = useMemo(() => {
    return steps.reduce<Record<number, Candidate[]>>((groups, step) => {
      groups[step.id] = candidates.filter((candidate) => candidateBelongsToStep(candidate, step));
      return groups;
    }, {});
  }, [candidates, steps]);

  async function moveCandidate(candidateId: string, targetStep: InterviewStep) {
    const candidate = candidates.find((item) => item.boardId === candidateId);

    if (!candidate || candidateBelongsToStep(candidate, targetStep)) {
      return;
    }

    const previousCandidates = candidates;

    setCandidates((currentCandidates) =>
      currentCandidates.map((item) =>
        item.boardId === candidateId
          ? { ...item, currentInterviewStep: targetStep.id }
          : item,
      ),
    );

    try {
      const response = await fetch(`${API_URL}/candidates/${getCandidateApiId(candidate)}/stage`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: getCandidateApiId(candidate),
          currentInterviewStep: targetStep.id,
          new_interview_step: targetStep.id,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar la etapa');
      }

      setError('');
    } catch {
      setCandidates(previousCandidates);
      setError('No se pudo actualizar la etapa del candidato. Intentalo de nuevo.');
    }
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, targetStep: InterviewStep) {
    event.preventDefault();
    const candidateId = draggedCandidateId || event.dataTransfer.getData('text/plain');

    if (candidateId) {
      moveCandidate(candidateId, targetStep);
    }

    setDraggedCandidateId(null);
  }

  return (
    <main className="position-page">
      <section className="position-header" aria-labelledby="position-title">
        <a className="back-link" href="/positions" aria-label="Volver al listado de posiciones">
          <span aria-hidden="true">←</span>
        </a>
        <div>
          <p className="eyebrow">Proceso de contratacion</p>
          <h1 id="position-title">{positionName || 'Position'}</h1>
        </div>
      </section>

      {error && (
        <p className="status-message" role="status">
          {error}
        </p>
      )}

      {loading ? (
        <div className="loading-state">Cargando candidatos...</div>
      ) : (
        <section className="kanban-board" aria-label="Candidatos por fase">
          {steps.map((step) => {
            const stepCandidates = candidatesByStep[step.id] || [];

            return (
              <article
                className="kanban-column"
                key={step.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, step)}
              >
                <header className="column-header">
                  <h2>{step.name}</h2>
                  <span>{stepCandidates.length}</span>
                </header>

                <div className="candidate-list">
                  {stepCandidates.length === 0 ? (
                    <p className="empty-column">Sin candidatos</p>
                  ) : (
                    stepCandidates.map((candidate) => (
                      <div
                        className="candidate-card"
                        draggable
                        key={candidate.boardId}
                        onDragStart={(event) => {
                          setDraggedCandidateId(candidate.boardId);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', candidate.boardId);
                        }}
                        onDragEnd={() => setDraggedCandidateId(null)}
                      >
                        <h3>{candidate.fullName}</h3>
                        <p>
                          <span>Puntuacion media</span>
                          <strong>{candidate.averageScore.toFixed(1)}</strong>
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default App;

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { Persona } from '@/services/rbac/rbacApi';
import notify from '@/utils/notify';
import { LivePreviewRail } from './LivePreviewRail';
import { PersonaWizardShell } from './PersonaWizardShell';
import {
  STEP_META,
  STEP_ORDER,
  type PersonaWizardMode,
  type StepKey,
} from './personaWizardTypes';
import { usePersonaWizardForm } from './usePersonaWizardForm';
import { WizardFooter } from './WizardFooter';
import { WizardStepper } from './WizardStepper';
import { BasicsStep } from './steps/BasicsStep';
import { CapabilitiesStep } from './steps/CapabilitiesStep';
import { IdentityStep } from './steps/IdentityStep';
import { IntelligenceStep } from './steps/IntelligenceStep';
import { ReviewStep } from './steps/ReviewStep';

export interface PersonaWizardModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly mode: PersonaWizardMode;
  readonly basePersona?: Persona | null;
  readonly onCreated?: (personaId: number, personaName: string) => void;
}

const stepVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export function PersonaWizardModal({
  isOpen,
  onClose,
  onSave,
  mode,
  basePersona,
  onCreated,
}: PersonaWizardModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [touchedSteps, setTouchedSteps] = useState<Set<StepKey>>(new Set(['basics']));

  const wizard = usePersonaWizardForm({
    isOpen,
    mode,
    basePersona,
    onSave,
    onClose,
    onCreated,
  });

  const currentStep = STEP_ORDER[stepIndex];
  const canAdvance = wizard.stepValidation[currentStep].valid;

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setTouchedSteps(new Set(['basics']));
    }
  }, [isOpen]);

  const goToStep = (index: number) => {
    if (index < 0 || index >= STEP_ORDER.length) return;
    if (index > stepIndex) {
      for (let i = stepIndex; i < index; i += 1) {
        const key = STEP_ORDER[i];
        if (!wizard.stepValidation[key].valid) {
          notify.error(wizard.stepValidation[key].reason ?? 'Complete this step first');
          return;
        }
      }
    }
    setStepIndex(index);
    setTouchedSteps((prev) => new Set(prev).add(STEP_ORDER[index]));
  };

  const handleNext = () => {
    if (!canAdvance) {
      notify.error(wizard.stepValidation[currentStep].reason ?? 'Please complete this step');
      return;
    }
    if (stepIndex === STEP_ORDER.length - 1) {
      void wizard.submitForm();
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleBack = () => goToStep(stepIndex - 1);

  const titleByMode: Record<PersonaWizardMode, string> = {
    edit: 'Edit Persona',
    version: 'Create New Version',
    create: 'Create Persona',
  };
  const title = titleByMode[mode];

  const personaLabel = wizard.formData.persona_name || 'Persona';
  const successMessageByMode: Record<PersonaWizardMode, string> = {
    edit: `${personaLabel} updated`,
    version: `${personaLabel} version created`,
    create: 'Persona created!',
  };
  const successMessage = successMessageByMode[mode];

  const renderStep = () => {
    switch (currentStep) {
      case 'basics':
        return (
          <BasicsStep
            formData={wizard.formData}
            setFormData={wizard.setFormData}
            isVersionMode={wizard.isVersionMode}
            isEditMode={wizard.isEditMode}
            nextVersionNumber={wizard.nextVersionNumber}
            showBasePersonaPicker={wizard.showBasePersonaPicker}
            basePersonaLocked={wizard.basePersonaLocked}
            availablePersonas={wizard.availablePersonas}
            effectiveBasePersona={wizard.effectiveBasePersona}
            loadingBasePersona={wizard.loadingBasePersona}
            onBasePersonaSelect={wizard.handleBasePersonaSelect}
          />
        );
      case 'identity':
        return (
          <IdentityStep formData={wizard.formData} setFormData={wizard.setFormData} />
        );
      case 'intelligence':
        return (
          <IntelligenceStep
            formData={wizard.formData}
            setFormData={wizard.setFormData}
            loadingModels={wizard.loadingModels}
            modelOptions={wizard.modelOptions}
            selectedModelDisplay={wizard.selectedModelDisplay}
            selectedModelMaxContextWindow={wizard.selectedModelMaxContextWindow}
            handleModelSelect={wizard.handleModelSelect}
          />
        );
      case 'capabilities':
        return (
          <CapabilitiesStep
            formData={wizard.formData}
            setFormData={wizard.setFormData}
            isVersionMode={wizard.isVersionMode}
            loadingDataSources={wizard.loadingDataSources}
            dataSourceOptions={wizard.dataSourceOptions}
            selectedDataSourceIds={wizard.selectedDataSourceIds}
            selectedDataSourceNames={wizard.selectedDataSourceNames}
            dataSourceNameMap={wizard.dataSourceNameMap}
            removeDataSource={wizard.removeDataSource}
            handleDataSourceSelect={wizard.handleDataSourceSelect}
            toolTagOptions={wizard.toolTagOptions}
            selectedToolTagIds={wizard.selectedToolTagIds}
            selectedToolTagNames={wizard.selectedToolTagNames}
            toolTagNameMap={wizard.toolTagNameMap}
            removeToolTag={wizard.removeToolTag}
            handleToolTagSelect={wizard.handleToolTagSelect}
            documentTagOptions={wizard.documentTagOptions}
            selectedDocumentTagIds={wizard.selectedDocumentTagIds}
            selectedDocumentTagNames={wizard.selectedDocumentTagNames}
            documentTagNameMap={wizard.documentTagNameMap}
            removeDocumentTag={wizard.removeDocumentTag}
            handleDocumentTagSelect={wizard.handleDocumentTagSelect}
            availableToolsForRules={wizard.availableToolsForRules}
            ruleTypes={wizard.ruleTypes}
          />
        );
      case 'review':
        return (
          <ReviewStep
            formData={wizard.formData}
            selectedModelDisplay={wizard.selectedModelDisplay}
            selectedToolTagNames={wizard.selectedToolTagNames}
            selectedDocumentTagNames={wizard.selectedDocumentTagNames}
            selectedDataSourceNames={wizard.selectedDataSourceNames}
            validation={wizard.stepValidation}
            goToStep={goToStep}
            isVersionMode={wizard.isVersionMode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PersonaWizardShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={STEP_META[currentStep].subtitle}
      stepper={
        <WizardStepper
          current={stepIndex}
          onStepClick={goToStep}
          validation={wizard.stepValidation}
          touched={touchedSteps}
        />
      }
      sidebar={
        <LivePreviewRail
          currentStep={currentStep}
          name={wizard.formData.persona_name}
          type={wizard.formData.type}
          greeting={wizard.formData.greeting_message}
          personaSnippet={
            wizard.formData.persona
              ? wizard.formData.persona.slice(0, 80)
              : undefined
          }
          tagCount={
            wizard.selectedToolTagIds.length + wizard.selectedDocumentTagIds.length
          }
          dataCount={wizard.selectedDataSourceIds.length}
          supportsDocuments={wizard.formData.supports_documents}
          modelDisplay={wizard.selectedModelDisplay || undefined}
        />
      }
      footer={
        <WizardFooter
          stepIndex={stepIndex}
          loading={wizard.loading}
          canAdvance={canAdvance}
          isVersionMode={wizard.isVersionMode}
          isEditMode={wizard.isEditMode}
          setAsCurrentVersion={wizard.setAsCurrentVersion}
          onSetAsCurrentVersionChange={wizard.setSetAsCurrentVersion}
          onBack={handleBack}
          onClose={onClose}
          onNext={handleNext}
        />
      }
      successOverlay={
        <AnimatePresence>
          {wizard.successFlash && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-surface/90"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="flex flex-col items-center gap-3 text-center px-6"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success/15 border-2 border-status-success/35">
                  <CheckCircle2 className="h-8 w-8 text-status-success" />
                </span>
                <p className="font-display font-semibold text-lg text-text-main">
                  {successMessage}
                </p>
                {wizard.formData.persona_name && mode === 'create' && (
                  <p className="text-sm text-text-muted">
                    {wizard.formData.persona_name} is ready to use.
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </PersonaWizardShell>
  );
}

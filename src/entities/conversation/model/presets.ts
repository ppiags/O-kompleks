import type { ConversationMessage } from '../../../shared/api/contracts'

export interface DemoPreset {
  id: string
  label: string
  hint: string
  text: string
}

/** Быстрые сценарии для демо и видео: не нужно вручную набирать длинный текст. */
export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'team-crm',
    label: 'Команда + CRM',
    hint: 'Тариф на 12 человек и интеграция с CRM',
    text: 'Здравствуйте. Хотим подключить ваш тариф для команды из 12 человек. Нужна интеграция с CRM. Сколько будет стоить и как быстро можно начать?',
  },
  {
    id: 'training',
    label: 'Обучение',
    hint: 'Обучение новых сотрудников',
    text: 'Здравствуйте! Подскажите, проводите ли вы обучение для новых сотрудников? У нас отдел продаж из 5 человек, хотим, чтобы они быстрее начали работать.',
  },
  {
    id: 'support',
    label: 'Проблема со входом',
    hint: 'Сценарий, где допродажа не нужна',
    text: 'Здравствуйте, у меня не работает вход в личный кабинет: письмо для сброса пароля не приходит. Помогите, пожалуйста, разобраться.',
  },
]

export interface ClientProfile {
  name: string
  company: string
  status: string
  plan: string
  owner: string
}

export const CLIENT_PROFILE: ClientProfile = {
  name: 'Анна Соколова',
  company: 'ООО «Вектор»',
  status: 'Новое обращение',
  plan: 'Тариф не выбран',
  owner: 'Вы · менеджер',
}

/** Фрагмент истории: визуально повторяет рабочий диалог менеджера в CRM. */
export const INITIAL_HISTORY: ConversationMessage[] = [
  {
    id: 'msg-1',
    role: 'client',
    author: 'Анна, клиент',
    time: '09:41',
    text: 'Добрый день! Изучаем варианты для отдела продаж.',
  },
  {
    id: 'msg-2',
    role: 'manager',
    author: 'Вы, менеджер',
    time: '09:43',
    text: 'Здравствуйте! Расскажите, пожалуйста, сколько человек в команде и какие задачи важны в первую очередь.',
  },
]

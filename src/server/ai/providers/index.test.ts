import { describe, expect, it } from 'vitest'
import { isAiError } from '../errors'
import { createAiProvider } from './index'

describe('createAiProvider', () => {
  it('создаёт mock при AI_PROVIDER=mock', () => {
    expect(createAiProvider({ AI_PROVIDER: 'mock' }).name).toBe('mock')
  })

  it('в режиме auto без ключей откатывается на mock', () => {
    expect(createAiProvider({}).name).toBe('mock')
    expect(createAiProvider({ AI_PROVIDER: 'auto' }).name).toBe('mock')
  })

  it('в режиме auto выбирает openai при наличии ключа', () => {
    expect(createAiProvider({ AI_PROVIDER: 'auto', OPENAI_API_KEY: 'sk-x' }).name).toBe('openai')
  })

  it('в режиме auto выбирает deepseek, если задан только его ключ', () => {
    expect(createAiProvider({ OPENAI_API_KEY: '', DEEPSEEK_API_KEY: 'ds-x' }).name).toBe('deepseek')
  })

  it('бросает CONFIG_ERROR для openai без ключа', () => {
    expect(() => createAiProvider({ AI_PROVIDER: 'openai' })).toThrowError(/OPENAI_API_KEY/)
  })

  it('бросает CONFIG_ERROR для deepseek без ключа', () => {
    expect(() => createAiProvider({ AI_PROVIDER: 'deepseek' })).toThrowError(/DEEPSEEK_API_KEY/)
  })

  it('бросает CONFIG_ERROR на неизвестного провайдера', () => {
    try {
      createAiProvider({ AI_PROVIDER: 'gemini' })
      throw new Error('должно было упасть')
    } catch (error) {
      expect(isAiError(error) && error.code === 'CONFIG_ERROR').toBe(true)
    }
  })

  it('регистр AI_PROVIDER не важен', () => {
    expect(createAiProvider({ AI_PROVIDER: 'MOCK' }).name).toBe('mock')
  })
})

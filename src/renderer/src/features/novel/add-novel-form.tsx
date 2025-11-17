import * as Form from '@radix-ui/react-form'
import { Button, Card, Flex, Heading, Select, TextArea, TextField } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

interface AddNovelFormProps {
  onClose: () => void
  onSubmit: (novel: {
    title: string
    author: string
    sourceLanguage: 'korean' | 'english' | 'japanese'
    description: string
  }) => void
}

export function AddNovelForm({ onClose, onSubmit }: AddNovelFormProps) {
  const { t } = useTranslation()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const novelData = {
      title: formData.get('title') as string,
      author: formData.get('author') as string,
      sourceLanguage: formData.get('sourceLanguage') as 'korean' | 'english' | 'japanese',
      description: formData.get('description') as string
    }
    onSubmit(novelData)
    onClose()
  }

  return (
    <Card size="5">
      <Form.Root onSubmit={handleSubmit}>
        <Flex direction="column" gap="4">
          <Heading size="6">{t('dashboard.addNovel')}</Heading>

          <Form.Field name="title">
            <Flex direction="column" gap="2">
              <Form.Label>{t('form.title')}</Form.Label>
              <Form.Control asChild>
                <TextField.Root size="3" placeholder={t('form.title')} required />
              </Form.Control>
              <Form.Message match="valueMissing">{t('form.validation.required')}</Form.Message>
            </Flex>
          </Form.Field>

          <Form.Field name="author">
            <Flex direction="column" gap="2">
              <Form.Label>{t('form.author')}</Form.Label>
              <Form.Control asChild>
                <TextField.Root size="3" placeholder={t('form.author')} required />
              </Form.Control>
              <Form.Message match="valueMissing">{t('form.validation.required')}</Form.Message>
            </Flex>
          </Form.Field>

          <Form.Field name="sourceLanguage">
            <Flex direction="column" gap="2">
              <Form.Label>{t('form.sourceLanguage')}</Form.Label>
              <Form.Control asChild>
                <Select.Root size="3" defaultValue="english">
                  <Select.Trigger placeholder={t('form.sourceLanguage')} />
                  <Select.Content>
                    <Select.Item value="english">
                      {t('dashboard.novel.language.english')}
                    </Select.Item>
                    <Select.Item value="korean">{t('dashboard.novel.language.korean')}</Select.Item>
                    <Select.Item value="japanese">
                      {t('dashboard.novel.language.japanese')}
                    </Select.Item>
                  </Select.Content>
                </Select.Root>
              </Form.Control>
            </Flex>
          </Form.Field>

          <Form.Field name="description">
            <Flex direction="column" gap="2">
              <Form.Label>{t('form.description')}</Form.Label>
              <Form.Control asChild>
                <TextArea placeholder={t('form.description')} rows={4} size="3" />
              </Form.Control>
            </Flex>
          </Form.Field>

          <Flex gap="3" justify="end" mt="4">
            <Button type="button" variant="soft" size="3" onClick={onClose}>
              {t('form.cancel')}
            </Button>
            <Form.Submit asChild>
              <Button size="3">{t('form.add')}</Button>
            </Form.Submit>
          </Flex>
        </Flex>
      </Form.Root>
    </Card>
  )
}

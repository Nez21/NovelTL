import { Select } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
  }

  return (
    <Select.Root value={i18n.language} onValueChange={handleLanguageChange}>
      <Select.Trigger variant="soft" />
      <Select.Content>
        <Select.Item value="en">English</Select.Item>
        <Select.Item value="vi">Tiếng Việt</Select.Item>
      </Select.Content>
    </Select.Root>
  )
}

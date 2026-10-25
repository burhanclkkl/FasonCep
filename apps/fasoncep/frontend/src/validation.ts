import type { WorkshopInput } from './api'

export function validateWorkshop(form: WorkshopInput): Partial<Record<keyof WorkshopInput, string>> {
  const errors: Partial<Record<keyof WorkshopInput, string>> = {}
  const name = form.name.trim()
  if (name.length < 2 || name.length > 120) errors.name = 'Atölye adı 2–120 karakter olmalı; yalnızca boşluk olamaz.'
  if (!form.work_types.length || form.work_types.length > 4 || new Set(form.work_types).size !== form.work_types.length ||
      form.work_types.some(type => !['Dikim', 'Kesim', 'Ütü / Paket', 'Diğer'].includes(type))) {
    errors.work_types = 'En az bir iş türü seçin.'
  }
  if (form.employee_band !== null && !['1-5', '6-10', '11-20', '21-50', '50+'].includes(form.employee_band)) {
    errors.employee_band = 'Listeden geçerli bir çalışan sayısı seçin.'
  }
  const phone = form.phone?.trim() ?? ''
  const digits = phone.replace(/[^0-9]/g, '')
  if (phone && (phone.length > 30 || !/^\+?[0-9 ()-]+$/.test(phone) || digits.length < 10 || digits.length > 15)) {
    errors.phone = 'Telefon 10–15 rakam içermeli. Başta +, boşluk, parantez ve tire kullanabilirsiniz.'
  }
  const email = form.email?.trim() ?? ''
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))) errors.email = 'Geçerli bir e-posta adresi girin (örn. iletisim@firma.com).'
  if ((form.address?.trim().length ?? 0) > 350) errors.address = 'Adres en fazla 350 karakter olabilir.'
  if ((form.description?.trim().length ?? 0) > 500) errors.description = 'Açıklama en fazla 500 karakter olabilir.'
  return errors
}

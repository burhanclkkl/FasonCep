import base64
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, BeforeValidator, field_validator, model_validator

MAX_SAFE_CENTS = 9_007_199_254_740_991
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Quantity = Annotated[int, Field(strict=True, gt=0, le=10_000_000)]


def iso_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('Tarih YYYY-AA-GG biçiminde olmalı.')
    return value


ISODate = Annotated[date, BeforeValidator(iso_date)]


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class CustomerInput(Input):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(default='', max_length=120)
    phone: str = Field(default='', max_length=30)
    email: str = Field(default='', max_length=254)

    @field_validator('phone')
    @classmethod
    def phone_format(cls, value):
        if value and (not re.fullmatch(r'\+?[0-9 ()-]+', value) or not 10 <= len(re.sub(r'\D', '', value)) <= 15):
            raise ValueError('Telefon 10–15 rakam içermeli.')
        return value

    @field_validator('email')
    @classmethod
    def email_format(cls, value):
        if value and not re.fullmatch(r'[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+', value):
            raise ValueError('Geçerli bir e-posta adresi girin.')
        return value


class Variant(Input):
    color: str = Field(min_length=1, max_length=60)
    size: str = Field(min_length=1, max_length=30)
    quantity: Quantity


class OrderInput(Input):
    customer: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    quantity: Quantity
    price: Money
    due: ISODate
    notes: str = Field(default='', max_length=3000)
    photo: str | None = Field(default=None, max_length=2_800_000)
    variants: list[Variant] = Field(default_factory=list, max_length=100)

    @field_validator('due')
    @classmethod
    def supported_date(cls, value):
        if value.year < 1900:
            raise ValueError('Tarih 1900 veya sonrası olmalı.')
        return value

    @field_validator('photo')
    @classmethod
    def valid_photo(cls, value):
        if value is None or value == '':
            return None
        match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)', value)
        if not match:
            raise ValueError('Fotoğraf PNG, JPEG veya WebP olmalı.')
        try:
            raw = base64.b64decode(match[2], validate=True)
        except ValueError:
            raise ValueError('Fotoğraf verisi geçersiz.')
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError('Fotoğraf en fazla 2 MB olabilir.')
        kind = match[1]
        valid = (kind == 'png' and raw.startswith(b'\x89PNG\r\n\x1a\n') or
                 kind == 'jpeg' and raw.startswith(b'\xff\xd8\xff') or
                 kind == 'webp' and raw.startswith(b'RIFF') and raw[8:12] == b'WEBP')
        if not valid:
            raise ValueError('Fotoğraf içeriği dosya türüyle uyuşmuyor.')
        return value

    @model_validator(mode='after')
    def variants_match(self):
        if self.quantity * int(self.price * 100) > MAX_SAFE_CENTS:
            raise ValueError('Sipariş tutarı desteklenen sınırı aşıyor.')
        if self.variants:
            if sum(v.quantity for v in self.variants) != self.quantity:
                raise ValueError('Renk/beden dağılımının toplamı sipariş adedine eşit olmalı.')
            keys = [(v.color.replace('I', 'ı').replace('İ', 'i').casefold(), v.size.replace('I', 'ı').replace('İ', 'i').casefold()) for v in self.variants]
            if len(set(keys)) != len(keys):
                raise ValueError('Aynı renk ve beden birden fazla kez eklenemez.')
        return self


class MovementInput(Input):
    order: str = Field(min_length=1, max_length=80)
    quantity: Quantity
    date: ISODate

    @field_validator('date')
    @classmethod
    def valid_date(cls, value):
        if value.year < 1900 or value > datetime.now(ZoneInfo('Europe/Istanbul')).date():
            raise ValueError('İşlem tarihi geçerli olmalı ve gelecekte olamaz.')
        return value


class PaymentInput(Input):
    customer: str = Field(min_length=1, max_length=80)
    amount: Money
    date: ISODate
    valid_date = field_validator('date')(MovementInput.valid_date.__func__)

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

WorkType = Literal["Dikim", "Kesim", "Ütü / Paket", "Diğer"]
EmployeeBand = Literal["1-5", "6-10", "11-20", "21-50", "50+"]


class WorkshopInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=120)
    work_types: list[WorkType] = Field(min_length=1, max_length=4)
    employee_band: EmployeeBand | None = None
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=254)
    address: str | None = Field(default=None, max_length=350)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if len(value) < 2:
            raise ValueError("İşletme adı en az iki karakter olmalı.")
        return value

    @field_validator("work_types")
    @classmethod
    def unique_types(cls, values: list[WorkType]) -> list[WorkType]:
        if len(values) != len(set(values)):
            raise ValueError("Aynı iş türü birden fazla seçilemez.")
        return values

    @field_validator("phone", "email", "address", "description", mode="before")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None or not isinstance(value, str):
            return value
        value = value.strip()
        return value or None


    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        if value is not None:
            digits = re.sub(r"[^0-9]", "", value)
            if not re.fullmatch(r"\+?[0-9 ()-]+", value) or not 10 <= len(digits) <= 15:
                raise ValueError("Telefon 10–15 rakam içermeli; başta +, boşluk, parantez ve tire kullanılabilir.")
        return value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", value):
            raise ValueError("Geçerli bir e-posta adresi girin.")
        return value


class WorkshopResponse(WorkshopInput):
    id: int
    created_at: str
    updated_at: str

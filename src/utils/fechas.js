function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

// Devuelve { inicio, fin } en formato YYYY-MM-DD para el atajo pedido.
export function calcularRangoRapido(tipo) {
  const hoy = new Date();

  if (tipo === 'hoy') {
    return { inicio: aISO(hoy), fin: aISO(hoy) };
  }

  if (tipo === 'semana') {
    const diaSemana = hoy.getDay(); // 0 = domingo
    const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diasDesdeElLunes);
    return { inicio: aISO(lunes), fin: aISO(hoy) };
  }

  if (tipo === 'mes') {
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { inicio: aISO(primerDia), fin: aISO(hoy) };
  }

  return null;
}

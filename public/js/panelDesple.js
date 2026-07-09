function toggleContenido() {
  const contenido = document.getElementById("contentButoon");
  
  if (contenido.style.display === "none") {
    contenido.style.display = "block";
  } else {
    contenido.style.display = "none";
  }
}
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace
COPY . .
RUN ./gradlew --no-daemon :server-kotlin:installDist

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV PORT=8080 \
    DATABASE_PATH=/data/autoflex.db \
    UPLOAD_DIR=/data/uploads
COPY --from=build /workspace/server-kotlin/build/install/server-kotlin /app
EXPOSE 8080
VOLUME ["/data"]
CMD ["/app/bin/server-kotlin"]

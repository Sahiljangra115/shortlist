# Sahil Kumar
**Portfolio:** [sahilkumar.dev](https://sahilkumar.dev)  
**Phone:** +91 8168560627 | **Email:** sahil115jangid@gmail.com | **LinkedIn:** [sahil-kumar-a1b148247](https://www.linkedin.com/in/sahil-kumar-a1b148247) | **GitHub:** [Sahiljangra115](https://github.com/Sahiljangra115)

## Summary
AI/ML Engineer with hands-on experience building and deploying deep learning models for computer vision, NLP, and multimodal AI systems. Built end-to-end projects including an autonomous robot with concurrent real-time vision/voice/hardware loops, a TinyML watchdog on ESP32-S3, a from-scratch multimodal RAG system, and an AI misinformation detector. Proficient in PyTorch, CUDA, FastAPI, and embedded systems (FreeRTOS, micro-ROS). Strong builder who ships tested, production-hardened code.

## Technical Skills
**Programming Languages:** C/C++, CUDA, Python, Java, JavaScript, SQL
**ML/AI Frameworks:** PyTorch, OpenCV, LangChain, LangGraph, LlamaIndex, Ollama
**Vector Stores & Databases:** FAISS, Chroma, Pinecone, PostgreSQL
**Backend & App Frameworks:** FastAPI, Flask-SocketIO, Flutter, Riverpod, Pydantic, Pytest
**Embedded & Robotics:** ESP-IDF, FreeRTOS, micro-ROS / ROS 2, Arduino, ESP32 / ESP32-S3
**Tools & Platforms:** Git, Docker, Linux, VS Code, GNU Make

## Projects

**NOIR: Autonomous Multimodal Robot Assistant** | [GitHub](https://github.com/Sahiljangra115/Noir) | Python, PyTorch, VLM, Ollama, Flutter | 2025
* Built a mobile robot running three concurrent real-time loops (vision, voice, hardware control) in Python, with shared state behind a reentrant lock and deep-copied snapshots so no loop holds a mutable reference into another.
* Shipped a fully local voice pipeline (openWakeWord hotword, Faster-Whisper STT on CUDA, Gemma 4 via Ollama, Piper TTS) that also accepts microphone audio streamed from the phone app.
* Stabilized YOLOv8n person tracking with an EMA filter so bounding-box jitter never reaches the motors, and trained a MobileNetV2 classifier for line following.
* Hardened every hardware action: Pydantic-validated LLM output, allow-listed motor commands with bounded durations, and ~2,000 lines of unit, integration, e2e, and resilience tests.
* Wrote the ESP32 firmware in C on FreeRTOS (ESP-IDF v6) driving an L298N H-bridge over TCP, plus a Flutter app for live telemetry and manual control over WebSocket.

**NyxCore: On-Device TinyML Watchdog for ROS 2** | [GitHub](https://github.com/Sahiljangra115/NyxCore) | C, ESP32-S3, micro-ROS, PyTorch | 2026
* Built an independent watchdog on a separate ESP32-S3 that monitors a robot's DDS streams and keeps reporting even when the main compute node stalls or crashes.
* Ran anomaly inference in pure C with no ML runtime: a Mahalanobis distance scorer (explicit 4x4 matrix multiply) and a sub-400-byte autoencoder trained in PyTorch, weights baked into firmware as static arrays.
* Scored each topic (cmd_vel, scan, odom) independently into a worst-case health level, with a 3-second silence watchdog catching dead publishers the statistical scores miss.
* Shipped it as a managed micro-ROS lifecycle node on FreeRTOS publishing diagnostic_msgs at 1 Hz, validated by a 9-script Python fault-injection harness (rate drops, jitter, message loss, silent topics).

**image-N: From-Scratch Multimodal RAG System** | [GitHub](https://github.com/Sahiljangra115/image-N) | Python, FAISS, CLIP, Ollama, FastAPI | 2026
* Built a multimodal Retrieval-Augmented Generation system from scratch in pure Python with zero framework glue: FAISS vector search, CLIP image retrieval, local Ollama LLMs, and a FastAPI service.
* Implemented semantic search over text and images using CLIP embeddings and FAISS indexing for fast approximate nearest-neighbor retrieval.
* Designed a clean API layer with FastAPI serving retrieval and generation endpoints, supporting both text-to-text and image-to-text queries.

**Holmes: AI Content Provenance & Misinformation Detector** | [GitHub](https://github.com/Sahiljangra115/Holmes) | PyTorch, DeBERTa-v3, ONNX, AWS Lambda, FastAPI | 2026
* Fused four independent detection signals (DeBERTa-v3 text classifier, C2PA/EXIF metadata, SynthID watermark detection, image forensics) into a calibrated confidence score with uncertainty estimation.
* Optimized the model pipeline with ONNX Runtime for low-latency inference and deployed the service on AWS Lambda for serverless scalability.
* Built the backend API with FastAPI, handling concurrent classification requests with structured input validation via Pydantic.

**HealthByte: Personalized Health & Nutrition Engine** | [GitHub](https://github.com/Sahiljangra115/HealthByte) | PyTorch, EfficientNet-B0, SQLite, Google Fit OAuth | 2026
* Trained an EfficientNet-B0 food classification model with uncertainty-banded calorie estimation, providing statistically honest confidence intervals on predictions.
* Built a biometric time-series pipeline using SQLite for persistent storage and Google Fit OAuth integration for real-time health data ingestion.
* Implemented statistically rigorous correlation analysis between nutrition intake and health metrics.

**Path Tracer: From-Scratch C++17 and CUDA Renderer** | [GitHub](https://github.com/Sahiljangra115/Path-tracer) | C++17, CUDA, Make | 2025
* Wrote a Monte Carlo path tracer twice with zero external dependencies: a single-file C++17 CPU reference (654 lines) and a CUDA port (586 lines) mapping one pixel to one GPU thread in 16x16 blocks.
* Ported the renderer to the GPU by turning the recursive bounce path into a bounded iterative loop accumulating attenuation, with device memory managed via cudaMalloc/cudaMemcpy/cudaFree.
* Implemented Lambertian, metal, and dielectric materials from the math (Snell refraction, Schlick Fresnel), jittered supersampling for anti-aliasing, and a thin-lens camera for real depth-of-field.
* Made renders reproducible with a --seed flag: Mersenne Twister on the CPU, inline per-thread XORShift on the GPU to avoid global-state contention.

## Additional Projects

**Kegel Trainer: Performance-Focused Flutter Wellness App** | Flutter, Dart, Riverpod (AI-assisted) | 2026
* Shipped a ~7,900-line Flutter app across 7 screens with zero bundled image assets; all art renders as inline SVG tinted from the active theme, scaling crisply at any size.
* Held frame rate stable on low-end phones by stripping blur and gradients from the render path, and cut the release APK from ~56 MB to 15-20 MB per ABI via R8 minification and ABI splitting.
* Built a bring-your-own-key AI coach over nine LLM providers that prompts from live app state, with user keys sent directly to the provider and never stored off-device.

## Education
**Deenbandhu Chhotu Ram University of Science and Technology** | Sonipat, Haryana
Bachelor of Technology in Electronics & Communication Engineering (AI/ML Specialization) | Nov 2023 - Present

## Experience & Achievements
**Robotics Club Coordinator** | October 2023 - Present
TH!NKBOTS, DCRUST, Murthal | Murthal, Haryana
* Coordinate club activities and mentor junior members on robotics fundamentals: Arduino programming, sensor integration, and project development.
* Developed club projects including a PID-controlled Line Follower bot and a Multi-Terrain Gripper bot.

**E-Yantra Robotics Competition | Team Leader** | 2024, 2025
* 2024: Led autonomous warehouse drone development using ROS2, OpenCV, and Gazebo simulation.
* 2025: Developed self-balancing lunar scout robot with PID/LQR control systems and Fusion 360 design.

**Smart India Hackathon** | 2024, 2025
* 2024: Team member; built a water conservation cross-platform game using Godot Engine.
* 2025: Team leader and event organizer, alongside competing as a member.

**IEEE YESIST12 2026 | Finalist** | 2026
* Selected for the international final round in Indonesia with an AI-based cloud anomaly detection project.

**Hackathon Finalist: Jewellery E-Commerce Platform** | 2025
* Built a full stack e-commerce website for a jewellery business and reached the finalist round.

import LandingScene from "../components/three/LandingScene";

const Landing = () => {
  return (
    <main>
      <section className="relative min-h-screen overflow-hidden">
        <div>
          <p>Modern Essentials</p>

          <h1>
            LASTDRIP <br /> FROM A DIFFERENT <br /> PERSPECTIVE.
          </h1>

          <p>Modern clothing for people who move differently.</p>

          <button>ENTER STORE</button>
        </div>

        <LandingScene />
      </section>
    </main>
  );
};

export default Landing;

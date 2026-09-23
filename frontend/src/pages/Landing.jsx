import LandingScene from "../components/three/LandingScene";

const Landing = () => {
  return (
    <main>
      <section className=" relative min-h-screen overflow-hidden">
        <div className=" relative z-10 px-6 pt-24 md:px-12 md:pt-32">
          <p className="text-label text-olive">Modern Essentials</p>

          <h1 className="heading-display mt-5 text-6xl leading-[0.9] md:text-8xl">
            LASTDRIP <br /> FROM A DIFFERENT <br /> PERSPECTIVE.
          </h1>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-charcoal md:text-base">
            Modern clothing for people who move differently.
          </p>

          <button className="mt-8 border border-ink px-6 py-3 text-sm font-semibold tracking-wide transition duration-200 hover:bg-ink hover:text-bone">
            ENTER STORE
          </button>
        </div>

        <LandingScene />
      </section>
    </main>
  );
};

export default Landing;
